
// * Imports for pulling all the data and schemas required for the sync

const { 
    fetchHubspotData, 
    fetchDealOwnerById, 
    createNewContact, 
    fetchContactById, 
    createNewDeal, 
    createAssociation, 
    updateDealInHubspot, 
    updateContactInHubspot,
    createNote,
    fetchNotesForDeal,
    fetchNotesForContact,
    fetchContactsFromHubspot,
    fetchDealsFromHubspot,
    fetchTasksforDeal, 
    fetchCallsforDeal, 
    fetchEmailsforDeal,
    fetchMeetingsforDeal,
    fetchOwnersFromHubspot,
    createBatchNote,
    createBulkContacts,
    updateBulkContacts,
    searchFunction,
    fetchDealById
} = require('../dataPulling/hubspotData');

const {
  fetchReapitData,
  fetchArchivedReapitData,
  negotiatorsData,
  fetchAllSources,
  fetchNegotiatorById,
  createNewNegotiator,
  contactsData,
  getContactById,
  createNewContactInReapit,
  reapitApplicants,
  reapitContacts,
  fetchApplicantById,
  getSourceById,
  createNewSource,
  fetchAllAreas,
  fetchAreaById,
  createNewArea,
  fetchApplicantJournal,
  createJournal,
  fetchRoleInContact,
  createBulkJournalEntries,
  archivedContactsData,
  fetchRelationshipsInContact,
  updateReapitContact,
} = require("../dataPulling/reapitData");

const { 
    reapitObj, 
    reapitContactObj 
} = require('../schemas/reapitSchema');

const { 
    hubspotDealsObj, 
    hubspotContactsObj 
} = require('../schemas/hubspotSchema');

const { 
    getFromCache, 
    setFromCache 
} = require('../dataPulling/cache');

const fs = require('fs');

// * -------------------------------------------------------------------------------------
// * Models imports 

const Reapit_Applicants = require('../models/reapitApplicants');
const Archived_Reapit_Applicants = require('../models/archivedReapitApplicants');
const Reapit_Contacts = require('../models/reapitContacts');
const Contacts = require('../models/contacts_V1');
const Sources = require("../models/sources");
const Areas = require("../models/areas")

//######################################################
//DO THE SIMILAR FETCH AND UPDATE FOR LAND LORDS TOOO
// Reapitdata.js make a function to fetch the detais from landlords api
// import it like Areas...
//######################################################

/*
 ** applicant data : ~12k applicants --> 120 api calls per cycle to fetch that data
 ** fetch journals entries of applicants --> 12k applicants if we assume 1 journal each, 12k api calls
 ** create/update apis are subject to number of applicants created/updated 
*/
// *--------------------------------------------------------------------------------------
// *Inbuilt/3rd party modules imports

// const fs = require('fs');
const NodeCache = require('node-cache');
const { convert } = require('html-to-text');

// *---------------------------------------------------------------------------------------
// * Helper function for sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// *---------------------------------------------------------------------------------------
// * Function to sync archived reapit applicants to hubspot contacts.
// * owner default changed to Raizul, added deal source in hubspot contact as deal source only, added home phone number field.
// * One time migration use (Dont include in cron)
async function archiveReapitApplicants(){

    try {
        console.log("Processing archive data of Reapit Applicants...");
    
        // await Reapit_Applicants.remove();
        var newContactArray = [];
        var updateContactArray = [];
        // await Archived_Reapit_Applicants.remove();
        // var reapit = await fetchArchivedReapitData();
        
        const [
            // reapit, 
            hubspotContacts, 
            owners
        ] = await Promise.all([
            // fetchArchivedReapitData(),
            fetchContactsFromHubspot(),
            fetchOwnersFromHubspot()
        ]);
        //console.log(archiveData.length === 0, archiveData.length)
        
        var archiveData = await Archived_Reapit_Applicants.find();
        var tempData = archiveData.slice(11000, 12000);
        if(archiveData.length === 0) {
            console.log("------*No archive data present*-------------")
            return {
                newContact: newContactArray,
                updateContact: updateContactArray
            }
        }


        const hubspotContactsMap = new Map();
        for (var hubCont of hubspotContacts) {
            const email = hubCont.properties.email;
            const mobilePhone = hubCont.properties.mobilephone;

            if (email) {
                hubspotContactsMap.set(email, hubCont);
            }

            if (mobilePhone) {
                hubspotContactsMap.set(mobilePhone, hubCont);
            }
        }
    
        var ownersMap = {};
        for(var owner of owners){
            ownersMap[owner.email] = owner.id;
        }

        for(var archApplicant of tempData){
            var emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+(?<![0-9])$/;
            
            for(var reapitContact of archApplicant.data.related){
                if(emailRegex.test(reapitContact.email)){
                    
                    var ownerID = "";
                    if(Array.isArray(archApplicant.data["_embedded"]["negotiators"])){
                        for(var negotiator of archApplicant.data["_embedded"]["negotiators"]){
                            var ownerMatch = ownersMap[negotiator.email]
                            if(ownerMatch){
                                ownerID = ownerMatch
                            }else{
                                ownerID = "707859911"
                            }
                        }
                    }else{
                        ownerID = "707859911"
                    }

                    var dealSource = ""
                    if(archApplicant.data["_embedded"]["source"]){
                        dealSource = archApplicant.data["_embedded"]["source"]["name"]
                    }


                    var matchedHubspotContact = false
                    var hsContact = {}

                    if(hubspotContactsMap.has(reapitContact.email) || hubspotContactsMap.has(reapitContact.mobilePhone)){
                        matchedHubspotContact = true
                        hsContact = hubspotContactsMap.get(reapitContact.email) || hubspotContactsMap.get(reapitContact.mobilePhone)
                    }
    
                    if(matchedHubspotContact){
                        
                        var updateContactSchema = {
                            properties: {
                                applicantid: archApplicant.data.id,
                                marketing_mode: archApplicant.data.marketingMode,
                                currency: archApplicant.data.currency,
                                active: archApplicant.data.active,
                                message_inquiry_comments: archApplicant.data.notes,
                                department_id: archApplicant.data.departmentId,
                                potential_client: archApplicant.data.potentialClient,
                                min_bedrooms: archApplicant.data.bedroomsMin,
                                max_bedrooms: archApplicant.data.bedroomsMax,
                                min_bathrooms: archApplicant.data.bathroomsMin,
                                max_bathrooms: archApplicant.data.bathroomsMax,
                                reapit_contact_id: reapitContact.id,
                                email: reapitContact.email,
                                date_of_birth: reapitContact.dateOfBirth,
                                firstname: reapitContact.forename,
                                lastname: reapitContact.surname,
                                phone: reapitContact.workPhone,
                                mobilephone: reapitContact.mobilePhone,
                                home_phone_number: reapitContact.homePhone,
                                deal_name: reapitContact.name,
                                pipeline: "default",
                                archived: "True",
                                price_from: archApplicant.data.buying?.priceFrom,
                                price_to: archApplicant.data.buying?.priceTo,
                                deal_owner: ownerID
                            }
                        }
    
                        if(!(archApplicant.data.source == null || archApplicant.data.source == undefined)){
                            const sourceInfo = await getSourceById(archApplicant.data.source.id);
                            if(sourceInfo.id){
                                console.log(`Sourcename found: ${sourceInfo.name}`);
                                updateContactSchema.properties.deal_source = sourceInfo.name;
                            }else{
                                console.log("Source Not found in Reapit.");
                            }
                        }
    
                        updateContactArray.push({
                            id: hsContact.id,
                            data: updateContactSchema
                        });
                        // update contact in hubspot.
                    }else{
                        const newHubspotContactSchema = {
                            properties: {
                                applicantid: archApplicant.data.id,
                                marketing_mode: archApplicant.data.marketingMode,
                                currency: archApplicant.data.currency,
                                active: archApplicant.data.active,
                                message_inquiry_comments: archApplicant.data.notes,
                                department_id: archApplicant.data.departmentId,
                                potential_client: archApplicant.data.potentialClient,
                                min_bedrooms: archApplicant.data.bedroomsMin,
                                max_bedrooms: archApplicant.data.bedroomsMax,
                                min_bathrooms: archApplicant.data.bathroomsMin,
                                max_bathrooms: archApplicant.data.bathroomsMax,
                                reapit_contact_id: reapitContact.id,
                                email: reapitContact.email,
                                date_of_birth: reapitContact.dateOfBirth,
                                firstname: reapitContact.forename,
                                lastname: reapitContact.surname,
                                phone: reapitContact.workPhone,
                                mobilephone: reapitContact.mobilePhone,
                                home_phone_number: reapitContact.homePhone,
                                deal_name: reapitContact.name,
                                pipeline: "default",
                                archived: "True",
                                price_from: archApplicant.data.buying?.priceFrom,
                                price_to: archApplicant.data.buying?.priceTo,
                                deal_owner: ownerID
                            }
                        }
    
                        if(!(archApplicant.data.source == null || archApplicant.data.source == undefined)){
                            const sourceInfo = await getSourceById(archApplicant.data.source.id);
                            if(sourceInfo.id){
                                console.log(`Sourcename found: ${sourceInfo.name}`);
                                newHubspotContactSchema.properties.deal_source = sourceInfo.name;
                            }else{
                                console.log("Source Not found in Reapit.");
                            }
                        }
    
                        Object.keys(newHubspotContactSchema.properties).forEach(key => {
                            if (newHubspotContactSchema.properties[key] === undefined || newHubspotContactSchema.properties[key] === null) {
                              delete newHubspotContactSchema.properties[key];
                            }
                        });
    
                        newContactArray.push(newHubspotContactSchema);
    
                        // create new contact in hubspot.
                    }
                }
            }
        }

        console.log("--------*All archived applicants processed*--------------")
        return {
            newContact: newContactArray,
            updateContact: updateContactArray
        }
    } catch (error) {
        return error
    }
}

const csv = require('csv-parser');

async function updateArchive(){

    var jsonData = [
        'OPN233140', 'OPN232817', 'OPN232535', 'OPN232269', 'OPN232072',
        'OPN231932', 'OPN231810', 'OPN231289', 'OPN230892', 'OPN230843',
        'DUB231291', 'OPN230665', 'OPN230664', 'JVG230237', 'DOW230255',
        'OPN230384', 'EMI230294', 'DUB230507', 'JVG230100', 'RAN230152',
        'DUB230301', 'RAN230122', 'DBI220025', 'OPN222346', 'OPN222285',
        'OPN222133', 'DOW220527', 'MAR221038', 'DUB728620', 'GRV220610',
        'OPN221950', 'JPJ220595', 'DOW220336', 'OPN221610', 'DUB725986',
        'OPN221532', 'DUB725565', 'EMI220880', 'RAN220490', 'OPN221447',
        'DUB723754', 'DUB722645', 'OPN221288', 'DUB721947', 'OPN221124',
        'OPN221080', 'DUB227805', 'DUB227119', 'DOW220122', 'MAR220327',
        'DUB226165', 'DUB225896', 'DUB225483', 'OPN220674', 'JVG220293',
        'OPN220619', 'DUB223966', 'OPN220350', 'DUB223297', 'DUB223222',
        'JVG220193', 'MAR220112', 'MAR220097', 'DUB222422', 'DUB222386',
        'DUB222249', 'DUB221109', 'DUB220257', 'DUB220167', 'DUB712686',
        'DUB711555', 'DUB710440', 'DUB215942', 'DBI719977', 'DBI717502',
        'DBI717323', 'DUB212374', 'DBI216490', 'DBI216148', 'DUB211027',
        'DBI211258', 'DBI208019', 'DBI205842', 'DBI202481', 'DUB208456',
        'DUB207438', 'DUB200831', 'DUB699732', 'DUB693292', 'DUB195918',
        'DUB195749', 'DUB192470', 'DUB684354', 'DUB180680', 'DUB177527',
        'DUB174692', 'DUB162181', 'DUB153295'
    ]

    const owners = await fetchOwnersFromHubspot()
    var ownersMap = {};
    for(var owner of owners){
        ownersMap[owner.email] = owner.id
    }

    // fs.createReadStream("C:/Users/Admin/Downloads/all-dealsHS.csv")
    // .pipe(csv())
    // .on('data', (row) => {
    //     jsonData.push(row)
    // })
    // .on('end', () => {
    //     fs.writeFileSync('updateArchive.json', JSON.stringify(jsonData))
    //     // console.log(jsonData.length)
    // })
    
    var updateBatch = []
    // console.log(jsonData[0])

    // return
    
    // var communityDetails = []
    const tempData = jsonData.slice(10,20);
    var batchedjsonData = []
    for(let i = 0; i < tempData.length; i+=4){
        batchedjsonData.push(tempData.slice(i, i+4))
    }
    var count = 1
    for(var batch of batchedjsonData){
        await Promise.all(
            batch.map(async (contact) => {

                const ifExists = await searchFunction("deals", "applicant_id", contact)
                console.log(ifExists.id)

                if(ifExists.id){

                    const details = await fetchApplicantById(contact)
                    // console.log(details._embedded)

                    var dealOwner2 = ""
                    if(details._embedded && details._embedded.negotiators[0]){
                        var neg2 = details._embedded.negotiators[0].email
                        console.log(neg2)
                        var findOwner = ownersMap[neg2]
                        
                        if(findOwner){
                            console.log(findOwner, "foundOwner")

                            updateBatch.push({
                                id: ifExists.id,
                                properties: {
                                    deal_owner_2: findOwner
                                }
                            })
                            console.log({
                                id: ifExists.id,
                                properties: {
                                    deal_owner_2: findOwner
                                }
                            })
                        }


                    }

                    
                
                    // updateBatch.push({
                    //     id: contact['Record ID'],
                    //     properties: {
                    //         archived_status: details.fromArchive
                    //     }
                    // })
    
                    // console.log({
                    //     id: contact['Record ID'],
                    //     properties: {
                    //         archived: details.fromArchive
                    //     }
                    // })
    
                    console.log(`Processed ID: ${contact} | count: ${count}`)
                    count++
                }
            })
        )
    }

    console.log(`updateBatch: ${updateBatch.length}`)
    // console.log(updateBatch)
    
    if(updateBatch.length > 0){
        await updateBulkContacts(updateBatch)
    }


    /*
    deal
    { dealstage: "Contact Made", modified: "22Aug", bedrooms: 4}


    applicant
    { statusId: "GE",  modified: "24Aug", bedrooms:4}

    */
}

// *---------------------------------------------------------------------------------------
// * Function to sync Hubspot Deals to Reapit Applicants.
// * Ready.....................now.
// ########################SYNC FAILS HERE FOR SOME DEALS ####################################
// Updates in HS are not correctly updated correctly in RT - randomly for some deals
// Currently upto 50 deals are incorrect
// USE postman to corerc the above deals immediatly
// API https://platform.reapit.cloud/applicants/${toUpdate.id} USE POSTMAN
// CONTACT OWNERS update in HS not happening ever in RT 
//
// BELOW IS NOT NEEDED FOR NOW -- FOR AHABB -- ***********************
// BELOW IS EXTRAAAA
// ARCHIVED DATA IN RT TO BE PUSHED INTO A NEW ARCHIVED OBJECT IN HUBSPOT
// ABOVE IS NOT FOR NOW
async function ReapitDataTransfer() {
        
    console.log('Reapit data transfer function started....');
    const [
      reapit,
      deals,
      owners,
      // reapit_contacts,
      negotiators
    ] = await Promise.all([
      fetchReapitData(),
      fetchDealsFromHubspot(),
      fetchOwnersFromHubspot(),
      // Contacts.find().then((contacts) => (contacts.length === 0 ? contactsData() : contacts)),
      negotiatorsData()
    ]);
    var reapit_data = reapit?.reapitApplicants 
    const areas = await Areas.find()
    const sources = await Sources.find()
    console.log("Areas: ", areas.length)
    console.log("Sources: ",sources.length)
    var transferToReapit = [];
    var newReapitData = [];
    var updateReapitData = [];

    var areasMap = {}
    for(var area of areas){
        areasMap[area.name] = area.id;
    }

    var ownersMap = {};
    for(var owner of owners){
        ownersMap[owner.id] = owner.email
    }

    var sourcesMap = {};
    for(var source of sources){
        sourcesMap[source.name] = source.id;
    }

    var negotiatorsMap = {}
    for(var negotiator of negotiators){
        negotiatorsMap[negotiator.email] = negotiator.id
    }

    console.log('Entering to mapping loop...');
    const testDeal = [await fetchDealById("9909284559")];
    // console.log(testDeal)
    // const tempData = deals.slice(2822,2823)

    var applicantsMap = {}
    for(var applicant of reapit_data){
        applicantsMap[applicant.data.id] = applicant.data;
    }

    const testFilterDeals = deals.filter((deal) => {
        return deal.properties.price_to && deal.properties.price_from && !deal.properties.applicant_id
    });

    console.log(testFilterDeals.length)
    // return
    // var testData = deals.slice(13000);
    var testData = testFilterDeals.slice(498);
    // console.log(testData)
    // return
    var count = 1;
    // const invalidDump = fs.createWriteStream('invalidObjects.json', { flags: 'a'})
    for (var data of testData) {
      console.log(`Processing deal: ${data.id} || count: ${count}`);
      var r_obj = reapitObj(data);
      var reapit_obj = applicantsMap[data.properties.applicant_id];
      // console.log(`Deal Owner ID : ${data.properties.hubspot_owner_id}`);
      var negotiatorID = "";
      if (data.properties.hubspot_owner_id) {
        var dealOwnerDetail = ownersMap[data.properties.hubspot_owner_id];
        // console.log(`Fetch Deal Owner By Id function called: ${dealOwnerDetail}`);
        var negData = negotiatorsMap[dealOwnerDetail];

        if (negData) {
          negotiatorID = negData;
        } else {
          negotiatorID = "ROP";
        }
      } else {
        negotiatorID = "ROP";
      }

      var areaInfoToFill = {
        locationType: "",
        locationOptions: [],
      };

      if (data.properties.community) {
        var communities = data.properties.community.split(";");
        for (var comm of communities) {
          var community = areasMap[comm];

          if (community) {
            areaInfoToFill.locationType = "areas";
            areaInfoToFill.locationOptions.push(community);
          }
        }
      }
      if (data.properties.sub_community) {
        var sub_communities = data.properties.sub_community.split(";");
        for (var sub_comm of sub_communities) {
          var subCommunity = areasMap[sub_comm];

          if (subCommunity) {
            areaInfoToFill.locationType = "areas";
            areaInfoToFill.locationOptions.push(subCommunity);
          } 
        }
      }

      var source = {
        id: "",
        type: "source",
      };

      if (
        !(
          data.properties.deal_source == undefined ||
          data.properties.deal_source == null ||
          data.properties.deal_source == ""
        )
      ) {
        var sourceData = sourcesMap[data.properties.deal_source];

        if (sourceData) {
          source.id = sourceData;
        } else {
          // create new source in reapit and then take that id.
          var sourceSchema = {
            name: data.properties.deal_source,
            type: "source",
            officeIds: null,
            departmentIds: null,
          };

          var newSource = await createNewSource(sourceSchema);
          source.id = newSource;
        }
      }

      var contactDetails = [];

      if (data.associations && data.associations.contacts) {
        // extract contact details from that contact
        for (var acontact of data.associations.contacts.results) {
          // console.log(acontact)
          const details = await fetchContactById(acontact.id);
          contactDetails.push(details);
        }
      } else {
        if (
          data.properties?.email ||
          data.properties?.first_name ||
          data.properties?.last_name
        ) {
          const newContactSchema = {
            properties: {
              email: data.properties?.email,
              firstname: data.properties?.first_name,
              lastname: data.properties?.last_name,
              pipeline: "default",
            },
          };
          Object.keys(newContactSchema.properties).forEach((key) => {
            if (
              newContactSchema.properties[key] === undefined ||
              newContactSchema.properties[key] === null
            ) {
              delete newContactSchema.properties[key];
            }
          });

          if (
            newContactSchema.properties.email &&
            newContactSchema.properties.lastname
          ) {
            const createNew = await createNewContact(newContactSchema);

            // creating association between that contact and deal
            const newAssociation = await createAssociation(
              data.id,
              createNew?.id === undefined ? createNew : createNew?.id
            );

            contactDetails.push(createNew);
          }
        }
      }

      var finalContactsToAssociate = [];

      for (var singleContact of contactDetails) {
        var flag = true;
        var filterType = {
          mobile: true,
          email: true,
        };

        if (
          !singleContact.properties?.email &&
          !singleContact.properties?.mobilephone
        ) {
          flag = false;
        }

        if (!singleContact.properties?.email) {
          filterType.email = false;
        }

        if (!singleContact.properties?.mobilephone) {
          filterType.mobile = false;
        }

        var matchQuery = {};

        if (filterType.email == true && filterType.mobile == false) {
          matchQuery = {
            "data.email": singleContact.properties.email,
          };
        }

        if (filterType.mobile == true && filterType.email == false) {
          matchQuery = {
            "data.mobilePhone": singleContact.properties.mobilephone,
          };
        }
        if (filterType.email == true && filterType.mobile == true) {
          matchQuery = {
            $or: [
              { "data.email": singleContact.properties.email },
              { "data.mobilePhone": singleContact.properties.mobilephone },
            ],
          };
        }

        // console.log(matchQuery)

        if (flag) {
          var reap_contact = null;

          const reapit_contacts = await Contacts.find(matchQuery);
          console.log("matched contacts", reapit_contacts.length);
          // return
          if (reapit_contacts.length === 1) reap_contact = reapit_contacts[0];
          else if (reapit_contacts.length > 1) {
            var nameFilter = reapit_contacts.filter((contact) => {
              const dataForename = contact.data?.forename;
              const dataSurname = contact.data?.surname;
              const propertiesFirstname = singleContact.properties?.firstname;
              const propertiesLastname = singleContact.properties?.lastname;

              return (
                (dataForename === propertiesFirstname ||
                  (!dataForename && !propertiesFirstname)) &&
                (dataSurname === propertiesLastname ||
                  (!dataSurname && !propertiesLastname))
              );
            });
            // console.log(nameFilter.length, "namefilter")
            if (nameFilter.length === 1) reap_contact = nameFilter[0];
            else if (nameFilter.length > 1) {
              var activeContact = nameFilter.filter((cont) => cont.data.active);
              // console.log(activeContact.length, "active")
              if (activeContact.length === 1) reap_contact = activeContact[0];
              else if (activeContact.length > 1) {
                var mostRecentData = activeContact.reduce((prev, current) => {
                  return prev.data.modified > current.data.modified
                    ? prev
                    : current;
                });
                // console.log(mostRecentData.data.id, "found")
                reap_contact = mostRecentData;
              } else {
                var modifiedFilter = reapit_contacts.reduce((prev, current) => {
                  return prev.data.modified > current.data.modified
                    ? prev
                    : current;
                });

                reap_contact = modifiedFilter;
              }
            }
          }
          // console.log(reap_contact)
          // return
          if (reap_contact) {
            if(reap_contact.data.fromArchive == true){
                // update contact archived to false
                const removeArchive = await updateReapitContact({
                    id: reap_contact.data.id,
                    data: {
                        fromArchive: false
                    }
                })
                if(removeArchive.success){
                    await Contacts.findOneAndUpdate({"data.id": reap_contact.data.id}, {"data.fromArchive": false});;
                }
            }
            finalContactsToAssociate.push({
              associatedId: reap_contact.data.id,
              associatedType: "contact",
            });
          } else {
            var contactSchema = reapitContactObj(singleContact);

            var contactOwnerID = "";
            if (singleContact.properties.hubspot_owner_id) {
              var dealOwnerDetail =
                ownersMap[singleContact.properties.hubspot_owner_id];
              // console.log(`Fetch Deal Owner By Id function called: ${dealOwnerDetail}`);

              var negData = negotiatorsMap[dealOwnerDetail];

              

              if (negData) {
                contactOwnerID = negData;
              } else {
                contactOwnerID = "ROP";
              }
            } else {
              contactOwnerID = "ROP";
            }

            var contactSource = {
              id: "",
              type: "source",
            };

            if (
              !(
                singleContact.properties.contact_source == undefined ||
                singleContact.properties.contact_source == null ||
                singleContact.properties.contact_source == ""
              )
            ) {
              var sourceData =
                sourcesMap[singleContact.properties.contact_source];

              if (sourceData) {
                contactSource.id = sourceData;
              } else {
                // create new source in reapit and then take that id.
                var sourceSchema = {
                  name: singleContact.properties.deal_source,
                  type: "source",
                  officeIds: null,
                  departmentIds: null,
                };

                var newSource = await createNewSource(sourceSchema);
                contactSource.id = newSource;
              }
            }

            if (contactSource.id) {
              contactSchema.source = contactSource;
            }
            contactSchema.negotiatorIds.push(contactOwnerID);

            Object.keys(contactSchema).forEach((key) => {
              if (
                contactSchema[key] === undefined ||
                contactSchema[key] === null
              ) {
                delete contactSchema[key];
              }
            });

            if (contactSchema.surname) {
              // console.log(contactSchema)

              const createNewContact = await createNewContactInReapit(
                contactSchema
              );
              sleep(10000);

              const reapitDetails = await getContactById(
                createNewContact.location
              );

              if (reapitDetails.id) {
                await Contacts.create({ data: reapitDetails });
                finalContactsToAssociate.push({
                  associatedId: reapitDetails.id,
                  associatedType: "contact",
                });
              }
            } else {
              console.log(
                "missing mandatory field for creating contact in reapit."
              );
            }
          }
        } else {
          console.log(
            "Associated contact does not contain both email and mobile phone number"
          );
        }
      }

      if (reapit_obj) {
        if (reapit_obj.modified > data.properties.hs_lastmodifieddate) {
          transferToReapit.push(reapit_obj);
        } else {
          var updatedJsonSchema = {
            active: data.properties.active ? data.properties.active : undefined,
            negotiatorIds: [],
            //specialFeatures: data.properties?.amenities?.split(";"),
            bedroomsMin: data.properties?.min_bedrooms ?? null,
            bedroomsMax:
              data.properties?.max_bedrooms &&
              data.properties?.max_bedrooms >=
                (data.properties?.min_bedrooms ?? 0)
                ? data.properties?.max_bedrooms
                : data.properties?.min_bedrooms ?? null,
            bathroomsMin: data.properties?.min_bathrooms ?? null,
            bathroomsMax: 
                data.properties?.max_bathrooms && 
                data.properties?.max_bathrooms >= 
                    (data.properties?.min_bathrooms ?? 0) 
                    ? data.properties?.max_bathrooms 
                    : data.properties?.min_bathrooms ?? null,
            source: source.id ? source : null,
            nextCall:
              data.properties?.future_prospecting_date &&
              new Date(data.properties.future_prospecting_date) > new Date()
                ? new Date(data.properties.future_prospecting_date)
                : null,
            locationType: areaInfoToFill.locationType
              ? areaInfoToFill.locationType
              : "none",
            locationOptions: areaInfoToFill.locationOptions,
            buying:
              data.properties.price_from &&
              data.properties.price_to &&
              parseInt(data.properties.price_to) >
                parseInt(data.properties.price_from)
                ? {
                    priceTo: 
                        parseInt(data.properties.price_to) > 2100000000 
                            ? 2100000000 
                            : parseInt(data.properties.price_to),
                    priceFrom: 
                        parseInt(data.properties.price_from) > 2000000000
                            ? 2000000000
                            : parseInt(data.properties.price_from),
                  }
                : null,
            metadata: {
              alternateEmail: data.properties?.alternate_email,
              amount: data.properties?.amount,
              city: data.properties.city,
              closeDate: data.properties.closedate,
              community: data.properties.community,
              country: data.properties.country,
              dealCategory: data.properties.deal_category,
              dealSource: data.properties.deal_source,
              description: data.properties.description,
              developer: data.properties.developer,
              hsAnalyticsLatestSource:
                data.properties.hs_analytics_latest_source,
              hsAnalyticsSource: data.properties.hs_analytics_source,
              nationality: data.properties.nationality,
              pipeline: data.properties.pipeline,
              projectName: data.properties.project_name,
              propertyType: data.properties.property_type,
              subCommunity: data.properties.sub_community,
              typeOfDeal: data.properties.type_of_deal,
              unitType: data.properties.unit_type,
              views: data.properties.views,
              hsObjectId: data.properties.hs_object_id,
              projectName: data.properties.project_name,
              reasonForLooking: data.properties.reason_for_looking,
              futureProspectingTimeframe:
                data.properties.future_prospecting_timeframe,
            },
          };

          if(data.properties.future_prospecting_date && new Date(data.properties.future_prospecting_date+'Z') > new Date()){
            updatedJsonSchema.nextCall = new Date(data.properties.future_prospecting_date)
          }

          if(data.properties.future_prospecting_date && new Date(data.properties.future_prospecting_date + 'Z') <= new Date()){
            updatedJsonSchema.lastCall = new Date(data.properties.future_prospecting_date)
          }

          if (!(data.properties.hubspot_owner_id === "707859911")) {
            updatedJsonSchema.negotiatorIds.push(negotiatorID);
          }

          if (data.properties.dealstage == "134449902") {
            updatedJsonSchema.statusId = "UQ";
          } else {
            if (data.properties.qualfication_status == "Hot")
              updatedJsonSchema.statusId = "HO";
            else if (data.properties.qualfication_status == "Warm")
              updatedJsonSchema.statusId = "GE";
            else if (data.properties.qualfication_status == "Cold")
              updatedJsonSchema.statusId = "CO";
          }

          Object.keys(updatedJsonSchema).forEach((key) => {
            if (
              updatedJsonSchema[key] === undefined ||
              updatedJsonSchema[key] === null ||
              updatedJsonSchema[key].length === 0
            ) {
              delete updatedJsonSchema[key];
            }
          });

          updateReapitData.push({
            id: reapit_obj.id,
            eTag: reapit_obj._eTag,
            data: updatedJsonSchema,
          });
        }
      } else {
        r_obj.locationType = areaInfoToFill.locationType
          ? areaInfoToFill.locationType
          : "none";
        r_obj.locationOptions = areaInfoToFill.locationOptions;
        r_obj.source = source.id ? source : null;

        if (data.properties.dealstage == "134449902") {
          r_obj.statusId = "UQ";
        } else {
          if (data.properties.qualfication_status == "Warm")
            r_obj.statusId = "GE";
          else if (data.properties.qualfication_status == "Hot")
            r_obj.statusId = "HO";
          else if (data.properties.qualfication_status == "Cold")
            r_obj.statusId = "CO";
        }

        r_obj.negotiatorIds.push(negotiatorID);

        r_obj.related = finalContactsToAssociate;

        Object.keys(r_obj).forEach((key) => {
          if (r_obj[key] === undefined || r_obj[key] === null) {
            delete r_obj[key];
          }
        });

        if (
          contactDetails.length != 0 &&
          r_obj.buying &&
          r_obj.related.length > 0
        ) {
          newReapitData.push(r_obj);
        } else {
          var logEntry = {
            data: r_obj,
          };
          // invalidDump.write(JSON.stringify(logEntry, null, 2) + "\n");

          console.log(
            `Either buying field is missing or related array is empty|| contactDetails: ${contactDetails.length} || buying field: ${r_obj?.buying} || related: ${r_obj.related.length}`
          );
        }
      }
      count++;
    }
    return {
        transferToReapit: transferToReapit,
        newReapitData: newReapitData,
        updateReapitData: updateReapitData
    }
}

// *---------------------------------------------------------------------------------------
// * Function to sync Reapit Applicants to Hubspot Deals via webhooks.

async function HubspotDataTransfer(WEBHOOK_BODY) {

    try {
        
        console.log('Hubspot data transfer function started...');
    
        const REAPIT_APPLICANT = WEBHOOK_BODY?.new
        console.log(REAPIT_APPLICANT);

        if(REAPIT_APPLICANT?.age?.includes("new")){

            //console.log(REAPIT_APPLICANT?.related);
            const [
                // contacts, 
                // deals, 
                owners, 
                negotiators
            ] = await Promise.all([
                // fetchContactsFromHubspot(),
                // fetchDealsFromHubspot(),
                fetchOwnersFromHubspot(),
                negotiatorsData()
            ])

            var ownersMap = {};
            for (var owner of owners) {
                ownersMap[owner.email] = owner.id;
            }

            var negotiatorsMap = {}
            for(var negotiator of negotiators){
                negotiatorsMap[negotiator.id] = negotiator
            }

            const applicantInfo = await fetchApplicantById(WEBHOOK_BODY?.entityId)
            console.log(applicantInfo)
            if(WEBHOOK_BODY.topicId === "applicants.created" && REAPIT_APPLICANT && !applicantInfo?.metadata?.hsObjectId){
                var matchForDeal = false;

                var hubspotDeal = await searchFunction("deals", "applicant_id", REAPIT_APPLICANT.id)

                if (hubspotDeal.id) matchForDeal = true;
                
                // for(var hsDeal of deals){
                //     if(hsDeal.properties.applicant_id == REAPIT_APPLICANT.id){
                //         matchForDeal = true;
                //         break;
                //     }
                // }
                if(matchForDeal){
                    console.log("Deal already exists in Hubspot.");
                }else{
        
                    const newHubspotDeal = hubspotDealsObj(REAPIT_APPLICANT);
        
                    var client_type = [];
                    for(var contact of REAPIT_APPLICANT.related){
                        const roles = await fetchRoleInContact(contact.id);
                        if(Array.isArray(roles.relationships) && roles.relationships.length > 0){
                            console.log("Adding client types now.");
                            for(var role of roles.relationships){
                                client_type.push(role.associatedType);
                            }
                        }else{
                            console.log("Relationships must not be an array or of length 0");
                        }
                    }
                    
                    var ownerID = ""
                    for(var id of REAPIT_APPLICANT.negotiatorIds){
                        var details = negotiatorsMap[id] // await fetchNegotiatorById(id);
                        console.log(`Fetch Negotiator By ID function called: ${details.id}`);
                        if(details){
                            console.log(`Negotiator email: ${details.email}`);
                            var matchExists = false;
                            var ownerD = {}
                            for(var oo of owners){
                                if(oo.email == details.email){
                                    matchExists = true;
                                    ownerD = oo;
                                    break;
                                }
                            }
                            // var matchExists = await hubspot_data.owners.find((o) => o.email === details.email);
                            //console.log(`match Exists in deal owner email: ${ownerD?.email}`);
                            if(matchExists){
                                ownerID = ownerD.id;
                            }else{
                                ownerID = "707859911";
                            }
                        }else{
                            ownerID = "707859911";
                        }
                    }
                    // console.log(ownerID)

                    // var [primaryOwner, ...additionalOwners] = ownerID
                    // console.log(primaryOwner, additionalOwners)
                    // return
        
                    if(REAPIT_APPLICANT.locationType == "areas" && Array.isArray(REAPIT_APPLICANT.locationOptions)){
                        var community = [];
                        var sub_community = [];
                        for(var option of REAPIT_APPLICANT.locationOptions){
                            const reapitArea = await fetchAreaById(option);
                            if(reapitArea.id){
                                if(Array.isArray(reapitArea.parentIds)){
                                    sub_community.push(reapitArea.name);
                                }else{
                                    community.push(reapitArea.name);
                                }
                            }else{
                                console.log("Reapit area not found.");
                            }
                        }
                        var comm = community.join(";");
                        var sub_comm = sub_community.join(";");
        
                        //console.log(comm, sub_comm);
                        newHubspotDeal.properties.community = comm;
                        newHubspotDeal.properties.sub_community = sub_comm;
        
                    }
                    
                    if(REAPIT_APPLICANT.statusId == "GE"){
                        newHubspotDeal.properties.dealstage = "134449907";
                        newHubspotDeal.properties.qualfication_status = "Warm";
                    }
                    else if(REAPIT_APPLICANT.statusId == "HO"){
                        newHubspotDeal.properties.dealstage = "134449907";
                        newHubspotDeal.properties.qualfication_status = "Hot";
                    }
                    else if(REAPIT_APPLICANT.statusId == "CO"){
                        newHubspotDeal.properties.dealstage = "134449907";
                        newHubspotDeal.properties.qualfication_status = "Cold";
                    }
                    else if (REAPIT_APPLICANT.statusId === "UQ"){
                        newHubspotDeal.properties.dealstage = "134449902";
                    }
        
                    newHubspotDeal.properties.future_prospecting_date = REAPIT_APPLICANT.nextCall;
                    var date = new Date();
                    var nextCallDate = new Date(REAPIT_APPLICANT.nextCall);
        
                    if(!(REAPIT_APPLICANT.nextCall == undefined || REAPIT_APPLICANT.nextCall == null)){
                        var diff = nextCallDate.getTime() - date.getTime();
                        var diffInMonths = diff/(1000*60*60*24*30)
        
                        if(diffInMonths > 3){
                            newHubspotDeal.properties.dealstage = "134502348";
                            newHubspotDeal.properties.qualfication_status = undefined;
                        }
                    }

                    console.log(newHubspotDeal.properties.dealstage, REAPIT_APPLICANT.statusId)
        
                    if(REAPIT_APPLICANT.source){
                        const sourceInfo = await getSourceById(REAPIT_APPLICANT.source.id);
                        if(sourceInfo.id){
                            console.log(`Sourcename found: ${sourceInfo.name}`);
                            newHubspotDeal.properties.deal_source = sourceInfo.name;
                        }else{
                            console.log("Source Not found in Reapit.");
                        }
                    }
        
                    newHubspotDeal.properties.client_type = client_type.join(";");
                    newHubspotDeal.properties.hubspot_owner_id = ownerID === undefined ? "707859911" : ownerID;
                    
                    const createNewDealInHubspot = await createNewDeal(newHubspotDeal);
                    console.log(createNewDealInHubspot, "-----------------------New Deal created-------------------");
                    var emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+(?<![0-9])$/;
                        for (var contact of REAPIT_APPLICANT.related) {
                            if(contact){

                                var contactById = await fetchRoleInContact(contact.id)
                                var contactOwnerId = '';
                                if(contactById && contactById.negotiators && contactById.negotiators.length > 0){
                                    for(var negotiator of contactById.negotiators){
                                        var findMatch = ownersMap[negotiator.email];
                                        if(findMatch){
                                            contactOwnerId = findMatch
                                        } else{
                                            contactOwnerId = null
                                        }
                                    }
                                }else{
                                    contactOwnerId = null
                                }

                                var sourceOfContact = "";
                                if(contactById.source){
                                    sourceOfContact = contactById.source.name;
                                }


                                if(emailRegex.test(contact.email)){
                                    console.log(contact.email, "-----Reapit one-----");

                                    var matchHubspotContact = false;
                                    
                                    var hubspotContact = await searchFunction("contacts", "email", contact.email) || await searchFunction("contacts", "mobilephone", contact.mobilePhone);
                                    if(hubspotContact.id) matchHubspotContact = true

                                    // if(contactsMap.has(contact.email) || contactsMap.has(contact.mobilePhone)){
                                    //     matchHubspotContact = true;
                                    //     hubspotContact = contactsMap.get(contact.email) || contactsMap.get(contact.mobilePhone)
                                    // }

                                    if (matchHubspotContact) {
                                        const createAssociationBetweenDealAndContact = await createAssociation(createNewDealInHubspot.id, hubspotContact.id);
        
                                        // update reapit contact id to hubspot contact
                                        const updateIDInHubspot = await updateContactInHubspot({
                                            id: hubspotContact.id,
                                            data: {
                                                properties: {
                                                    reapit_contact_id: contact.id,
                                                    client_type: client_type.join(";")
                                                }
                                            }
                                        })
                                        // // TODO: Create a association between dealId and hubspotContact.id 
                                    } else {
                                        const contactSchema = {
                                            properties: {
                                                //type: "contact",
                                                email: contact.email,
                                                firstname: contact.forename,
                                                lastname: contact.surname,
                                                date_of_birth: contact.dateOfBirth,
                                                phone: contact.workPhone,
                                                mobilephone: contact.mobilePhone,
                                                reapit_contact_id: contact.id,
                                                home_phone_number: contact.homePhone,
                                                archived: "False",
                                                pipeline: "default",
                                                client_type: client_type.join(";"),
                                                hubspot_owner_id: contactOwnerId,
                                                contact_source: sourceOfContact
                                            }
                                        }

                                        if(!contact.email && contact.mobilePhone){
                                            const randomSeries = Math.floor(Math.random() * 900000) + 100000
                                            contactSchema.properties.email = `${contact.mobilePhone.replace(/[()\-\s]/g, "")}_${randomSeries}@hnh.com`
                                        }
                                        //console.log(contactSchema);
                                        const createNew = await createNewContact(contactSchema);
                                        console.log(createNew.id === undefined ? createNew: createNew.id, createNewDealInHubspot.id);
                                        const newAssociation = await createAssociation(createNewDealInHubspot.id, createNew.id === undefined? createNew:createNew.id )
                                        
                                    }
                                }
                            }
                        }
                }
        
            }else if(WEBHOOK_BODY.topicId == "applicants.modified" && REAPIT_APPLICANT){
                console.log("updating",REAPIT_APPLICANT);
                
                var updatedFields = WEBHOOK_BODY.diff;
        
                var matchForDeal = false;
                var hubspotDeal = await searchFunction(
                  "deals",
                  "applicant_id",
                  REAPIT_APPLICANT.id
                ) 
                
                var hubspotDeal2 = await fetchDealById(applicantInfo?.metadata?.hsObjectId)

                var dealToBeUpdated = {}
                if (hubspotDeal?.id) {
                    matchForDeal = true;
                    dealToBeUpdated = hubspotDeal
                } else if(hubspotDeal2?.id) {
                    matchForDeal = true;
                    dealToBeUpdated = hubspotDeal2
                } else{
                    matchForDeal = false
                }
                // for(var dtbu of deals){
                //     if(dtbu.properties.applicant_id == REAPIT_APPLICANT.id){
                //         matchForDeal = true;
                //         dealToBeUpdated = dtbu;
                //         break;
                //     }
                // }
                
        
                if(matchForDeal){
                    var applicantDetails = applicantInfo;

                    var ownerID = ""
                    for(var id of REAPIT_APPLICANT.negotiatorIds){
                        var details = negotiatorsMap[id] // await fetchNegotiatorById(id);
                        console.log(`Fetch Negotiator By ID function called: ${details.id}`);
                        if(details){
                            console.log(`Negotiator email: ${details.email}`);
                            var matchExists = false;
                            var ownerD = {}
                            for(var oo of owners){
                                if(oo.email == details.email){
                                    matchExists = true;
                                    ownerD = oo;
                                    break;
                                }
                            }
                            // var matchExists = await hubspot_data.owners.find((o) => o.email === details.email);
                            //console.log(`match Exists in deal owner email: ${ownerD?.email}`);
                            if(matchExists){
                                ownerID = ownerD.id;
                            }else{
                                ownerID = "707859911";
                            }
                        }else{
                            ownerID = "707859911";
                        }
                    }

                    if(REAPIT_APPLICANT.locationType == "areas" && Array.isArray(REAPIT_APPLICANT.locationOptions)){
                        var community = [];
                        var sub_community = [];
                        for(var option of REAPIT_APPLICANT.locationOptions){
                            const reapitArea = await fetchAreaById(option);
                            if(reapitArea.id){
                                if(Array.isArray(reapitArea.parentIds)){
                                    sub_community.push(reapitArea.name);
                                }else{
                                    community.push(reapitArea.name);
                                }
                            }else{
                                console.log("Reapit area not found.");
                            }
                        }
                        var comm = community.join(";");
                        var sub_comm = sub_community.join(";");
        
                        console.log(comm, sub_comm);
                        dealToBeUpdated.properties.community = comm;
                        dealToBeUpdated.properties.sub_community = sub_comm;
        
                    }

                    if(REAPIT_APPLICANT.statusId == "UQ") console.log('status is UQ therefore not updating in HS')
                    else if (REAPIT_APPLICANT.statusId == "GE") dealToBeUpdated.properties.qualfication_status = "Warm"
                    else if (REAPIT_APPLICANT.statusId == "CO") dealToBeUpdated.properties.qualfication_status = "Cold"
                    else if(REAPIT_APPLICANT.statusId == "HO") dealToBeUpdated.properties.qualfication_status = "Hot"
        
                    dealToBeUpdated.properties.future_prospecting_date = REAPIT_APPLICANT.nextCall;
        
                    var date = new Date();
                    var nextCallDate = new Date(REAPIT_APPLICANT.nextCall);
                    if(!(REAPIT_APPLICANT.nextCall == undefined || REAPIT_APPLICANT.nextCall == null)){
                        var diff = nextCallDate.getTime() - date.getTime();
                        var diffInMonths = diff/(1000*60*60*24*30)
        
                        if(diffInMonths > 3){
                            dealToBeUpdated.properties.dealstage = "134502348";
                            dealToBeUpdated.properties.qualfication_status = undefined;
                        }
                    }
        
                    if(!(REAPIT_APPLICANT.source == null || REAPIT_APPLICANT.source == undefined)){
                        const sourceInfo = await getSourceById(REAPIT_APPLICANT.source.id);
                        if(sourceInfo.id){
                            console.log(`Sourcename found: ${sourceInfo.name}`);
                            dealToBeUpdated.properties.deal_source = sourceInfo.name;
                        }else{
                            console.log("Source Not found in Reapit.");
                        }
                    }
                    dealToBeUpdated.properties.activity_type = applicantDetails?.metadata?.activityType;
                    dealToBeUpdated.properties.alternate_email = applicantDetails?.metadata?.alternateEmail;
                    dealToBeUpdated.properties.max_bathrooms = applicantDetails?.bathroomsMax;
                    dealToBeUpdated.properties.min_bathrooms = applicantDetails?.bathroomsMin;
                    dealToBeUpdated.properties.max_bedrooms = applicantDetails?.bedroomsMax;
                    dealToBeUpdated.properties.min_bedrooms = applicantDetails?.bedroomsMin;
                    //dealToBeUpdated.properties.amenities = applicantDetails?.specialFeatures?.join(';');
                    dealToBeUpdated.properties.amount = applicantDetails?.metadata?.amount;
                    dealToBeUpdated.properties.assigned_date = applicantDetails?.metadata?.assignedDate;
                    dealToBeUpdated.properties.booking_date = applicantDetails?.metadata?.bookingDate;
                    dealToBeUpdated.properties.city = applicantDetails?.metadata?.city;
                    //dealToBeUpdated.properties.client_type = applicantDetails?.metadata?.clientType;
                    dealToBeUpdated.properties.closedate = applicantDetails?.metadata?.closeDate;
                    //dealToBeUpdated.properties.community =applicantDetails?.metadata?.community;
                    //dealToBeUpdated.properties.sub_community = applicantDetails?.metadata?.subCommunity,
                    dealToBeUpdated.properties.country =applicantDetails?.metadata?.country;
                    dealToBeUpdated.properties.deal_category =applicantDetails?.metadata?.dealCategory;
                    //dealToBeUpdated.properties.deal_source =applicantDetails?.metadata?.dealSource;
                    dealToBeUpdated.properties.description =applicantDetails?.metadata?.description;
                    dealToBeUpdated.properties.developer =applicantDetails?.metadata?.developer;
                    dealToBeUpdated.properties.hubspot_owner_id = ownerID === undefined ? "707859911" : ownerID;
                    dealToBeUpdated.properties.price_from = applicantDetails.buying?.priceFrom;
                    dealToBeUpdated.properties.price_to = applicantDetails.buying?.priceTo;
                    //dealToBeUpdated.properties.dealname = REAPIT_APPLICANT.related[0].name;
                    //dealToBeUpdated.properties.email = REAPIT_APPLICANT.related[0].email;
                    dealToBeUpdated.properties.project_name = applicantDetails?.metadata?.projectName;
                    dealToBeUpdated.properties.reason_for_looking = applicantDetails?.metadata?.reasonForLooking;
                    dealToBeUpdated.properties.future_prospecting_timeframe = applicantDetails?.metadata?.futureProspectingTimeframe;
                    dealToBeUpdated.properties.message_inquiry_comments = applicantDetails.notes;
                    dealToBeUpdated.properties.archived_status = applicantDetails.fromArchive;
                    dealToBeUpdated.properties.active = applicantDetails.active

                    // dealToBeUpdated.properties.pipeline = "default";
        
                    Object.keys(dealToBeUpdated.properties).forEach(key => {
                        if (dealToBeUpdated.properties[key] === undefined || dealToBeUpdated.properties[key] === null) {
                          delete dealToBeUpdated.properties[key];
                        }
                    });
        
                    const sendDealToHubspot = await updateDealInHubspot(dealToBeUpdated);
                }else{
                    console.log("deal not found in hubspot, creating a new one");
                    const newHubspotDeal = hubspotDealsObj(REAPIT_APPLICANT);
        
                    var client_type = [];
                    for(var contact of REAPIT_APPLICANT.related){
                        const roles = await fetchRoleInContact(contact.id);
                        if(Array.isArray(roles.relationships) && roles.relationships.length > 0){
                            console.log("Adding client types now.");
                            for(var role of roles.relationships){
                                client_type.push(role.associatedType);
                            }
                        }else{
                            console.log("Relationships must not be an array or of length 0");
                        }
                    }
                    
                    var ownerID = ""
                    for(var id of REAPIT_APPLICANT.negotiatorIds){
                        var details = negotiatorsMap[id] // await fetchNegotiatorById(id);
                        console.log(`Fetch Negotiator By ID function called: ${details.id}`);
                        if(details){
                            console.log(`Negotiator email: ${details.email}`);
                            var matchExists = false;
                            var ownerD = {}
                            for(var oo of owners){
                                if(oo.email == details.email){
                                    matchExists = true;
                                    ownerD = oo;
                                    break;
                                }
                            }
                            // var matchExists = await hubspot_data.owners.find((o) => o.email === details.email);
                            //console.log(`match Exists in deal owner email: ${ownerD?.email}`);
                            if(matchExists){
                                ownerID = ownerD.id;
                            }else{
                                ownerID = "707859911";
                            }
                        }else{
                            ownerID = "707859911";
                        }
                    }
        
                    if(REAPIT_APPLICANT.locationType == "areas" && Array.isArray(REAPIT_APPLICANT.locationOptions)){
                        var community = [];
                        var sub_community = [];
                        for(var option of REAPIT_APPLICANT.locationOptions){
                            const reapitArea = await fetchAreaById(option);
                            if(reapitArea.id){
                                if(Array.isArray(reapitArea.parentIds)){
                                    sub_community.push(reapitArea.name);
                                }else{
                                    community.push(reapitArea.name);
                                }
                            }else{
                                console.log("Reapit area not found.");
                            }
                        }
                        var comm = community.join(";");
                        var sub_comm = sub_community.join(";");
        
                        //console.log(comm, sub_comm);
                        newHubspotDeal.properties.community = comm;
                        newHubspotDeal.properties.sub_community = sub_comm;
        
                    }
                    
                    if(REAPIT_APPLICANT.statusId == "GE"){
                        newHubspotDeal.properties.dealstage = "134449907";
                        newHubspotDeal.properties.qualfication_status = "Warm";
                    }
                    else if(REAPIT_APPLICANT.statusId == "HO"){
                        newHubspotDeal.properties.dealstage = "134449907";
                        newHubspotDeal.properties.qualfication_status = "Hot";
                    }
                    else if(REAPIT_APPLICANT.statusId == "CO"){
                        newHubspotDeal.properties.dealstage = "134449907";
                        newHubspotDeal.properties.qualfication_status = "Cold";
                    }
                    else if (REAPIT_APPLICANT.statusId === "UQ"){
                        newHubspotDeal.properties.dealstage = "134449902";
                    }
                    
                    newHubspotDeal.properties.future_prospecting_date = REAPIT_APPLICANT.nextCall;
        
                    var date = new Date();
                    var nextCallDate = new Date(REAPIT_APPLICANT.nextCall);
        
                    if(!(REAPIT_APPLICANT.nextCall == undefined || REAPIT_APPLICANT.nextCall == null)){
                        var diff = nextCallDate.getTime() - date.getTime();
                        var diffInMonths = diff/(1000*60*60*24*30)
        
                        if(diffInMonths > 3){
                            newHubspotDeal.properties.dealstage = "134502348";
                            newHubspotDeal.properties.qualfication_status = undefined;
                        }
                    }
        
                    if(REAPIT_APPLICANT.source){
                        const sourceInfo = await getSourceById(REAPIT_APPLICANT.source.id);
                        if(sourceInfo.id){
                            console.log(`Sourcename found: ${sourceInfo.name}`);
                            newHubspotDeal.properties.deal_source = sourceInfo.name;
                        }else{
                            console.log("Source Not found in Reapit.");
                        }
                    }
        
                    newHubspotDeal.properties.client_type = client_type.join(";");
                    newHubspotDeal.properties.hubspot_owner_id = ownerID === undefined ? "707859911" : ownerID;
                    
                    const createNewDealInHubspot = await createNewDeal(newHubspotDeal);
                    console.log(createNewDealInHubspot, "-----------------------New Deal created-------------------");
                    var emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+(?<![0-9])$/;
                        for (var contact of REAPIT_APPLICANT.related) {
                            if(contact){

                                var contactById = await fetchRoleInContact(contact.id)
                                var contactOwnerId = '';
                                if(contactById && contactById.negotiators && contactById.negotiators.length > 0){
                                    for(var negotiator of contactById.negotiators){
                                        var findMatch = ownersMap[negotiator.email];
                                        if(findMatch){
                                            contactOwnerId = findMatch
                                        } else{
                                            contactOwnerId = null
                                        }
                                    }
                                }else{
                                    contactOwnerId = null
                                }

                                var sourceOfContact = "";
                                if(contactById.source){
                                    sourceOfContact = contactById.source.name;
                                }


                                if(emailRegex.test(contact.email)){
                                    console.log(contact.email, "-----Reapit one-----");

                                    var matchHubspotContact = false;
                                    
                                    var hubspotContact = await searchFunction("contacts", "email", contact.email) || await searchFunction("contacts", "mobilephone", contact.mobilePhone);
                                    if(hubspotContact.id) matchHubspotContact = true

                                    // if(contactsMap.has(contact.email) || contactsMap.has(contact.mobilePhone)){
                                    //     matchHubspotContact = true;
                                    //     hubspotContact = contactsMap.get(contact.email) || contactsMap.get(contact.mobilePhone)
                                    // }

                                    if (matchHubspotContact) {
                                        const createAssociationBetweenDealAndContact = await createAssociation(createNewDealInHubspot.id, hubspotContact.id);
        
                                        // update reapit contact id to hubspot contact
                                        const updateIDInHubspot = await updateContactInHubspot({
                                            id: hubspotContact.id,
                                            data: {
                                                properties: {
                                                    reapit_contact_id: contact.id,
                                                    client_type: client_type.join(";")
                                                }
                                            }
                                        })
                                        // // TODO: Create a association between dealId and hubspotContact.id 
                                    } else {
                                        const contactSchema = {
                                            properties: {
                                                //type: "contact",
                                                email: contact.email,
                                                firstname: contact.forename,
                                                lastname: contact.surname,
                                                date_of_birth: contact.dateOfBirth,
                                                phone: contact.workPhone,
                                                mobilephone: contact.mobilePhone,
                                                reapit_contact_id: contact.id,
                                                home_phone_number: contact.homePhone,
                                                archived: "False",
                                                pipeline: "default",
                                                client_type: client_type.join(";"),
                                                hubspot_owner_id: contactOwnerId,
                                                contact_source: sourceOfContact
                                            }
                                        }

                                        if(!contact.email && contact.mobilePhone){
                                            const randomSeries = Math.floor(Math.random() * 900000) + 100000
                                            contactSchema.properties.email = `${contact.mobilePhone.replace(/[()\-\s]/g, "")}_${randomSeries}@hnh.com`
                                        }
                                        //console.log(contactSchema);
                                        const createNew = await createNewContact(contactSchema);
                                        console.log(createNew.id === undefined ? createNew: createNew.id, createNewDealInHubspot.id);
                                        const newAssociation = await createAssociation(createNewDealInHubspot.id, createNew.id === undefined? createNew:createNew.id )
                                        
                                    }
                                }
                            }
                        }
                }
            }else{
                console.log("Either invalid topicId or applicantInfo not fetched properly or contains dealId in metadata")
            }
        }else{
            console.log("Not an offplan applicant or came from HS only because hs id is present in metadata");
        }
    } catch (error) {
        console.log(error);
        return error
    }

}

// *---------------------------------------------------------------------------------------
// * Function to sync existing Reapit Applicants to Hubspot Deals.
// * took 18 minutes, that too in case where there are only 5 new deal and 0 updates.
async function ExistingHubspotDataTransfer() {
  try {
    console.log("Hubspot Data Transfer function started.");

    await Reapit_Applicants.remove();
    const [
      reapit,
      deals,
      owners,
      // contacts
    ] = await Promise.all([
      fetchReapitData(),
      fetchDealsFromHubspot(),
      fetchOwnersFromHubspot(),
      // fetchContactsFromHubspot()
    ]);

    var start_date = new Date('2023-11-27');
    var end_date = new Date('2023-11-28');

    // const xxx = fs.readFileSync('applicants1.json')
    // return
    // var reapit = await fetchReapitData();
    var reapit_data = reapit.reapitApplicants; // JSON.parse(xxx) // reapit.reapitApplicants;
    
    var timefilter = reapit_data.filter((item) => {
        const createDate = new Date(item.data.created);
        return createDate >= start_date && createDate <=end_date;
    })
    console.log(timefilter.length)
    // return
    var tempData = timefilter;

    var ownersMap = {};
    for (var owner of owners) {
      ownersMap[owner.email] = owner.id;
    }

    var dealsMap = {};
    for (var deal of deals) {
      dealsMap[deal.properties.applicant_id] = deal;
    }

    var transferToHubspotDeals = [];
    var newHubspotDealsData = [];
    var updateHubspotDealsData = [];

    console.log("Entering to mapping loop...");

    for (var data of tempData) {
      console.log(`Processing applicant: ${data.data.id}`);
      var ownerID = "";
      if (Array.isArray(data.data["_embedded"]["negotiators"])) {
        for (var negotiator of data.data["_embedded"]["negotiators"]) {
          var ownerMatch = ownersMap[negotiator.email];
          if (ownerMatch) {
            ownerID = ownerMatch;
          } else {
            ownerID = "707859911";
          }
        }
      } else {
        ownerID = "707859911";
      }

      var client_type = [];
      for (var contact of data.data.related) {
        const roles = await fetchRoleInContact(contact.id);
        if (
          Array.isArray(roles.relationships) &&
          roles.relationships.length > 0
        ) {
          for (var role of roles.relationships) {
            client_type.push(role.associatedType);
          }
        } else {
          console.log("Relationships must not be an array or of length 0");
        }
      }

      var hubspot_obj = dealsMap[data.data.id];
      if (hubspot_obj) {
        if (hubspot_obj.properties.hs_lastmodifieddate > data.data.modified) {
          transferToHubspotDeals.push(hubspot_obj);
        } else {
          console.log("In update batch: ", data.data.id);
          hubspot_obj.properties.activity_type =
            data.data.metadata?.activityType;
          hubspot_obj.properties.alternate_email =
            data.data.metadata?.alternateEmail;
          // hubspot_obj.properties.amenities = data.data.specialFeatures?.join(';');
          hubspot_obj.properties.amount = data.data.metadata?.amount;
          hubspot_obj.properties.assigned_date =
            data.data.metadata?.assignedDate;
          hubspot_obj.properties.booking_date = data.data.metadata?.bookingDate;
          hubspot_obj.properties.city = data.data.metadata?.city;
          hubspot_obj.properties.client_type = client_type.join(";");
          hubspot_obj.properties.closedate = data.data.metadata?.closeDate;

          hubspot_obj.properties.country = data.data.metadata?.country;
          (hubspot_obj.properties.max_bathrooms = data.data?.bathroomsMax),
            (hubspot_obj.properties.min_bathrooms = data.data?.bathroomsMin),
            (hubspot_obj.properties.max_bedrooms = data.data?.bedroomsMax),
            (hubspot_obj.properties.min_bedrooms = data.data?.bedroomsMin),
            //hubspot_obj.dealName =data.data.metadata.dealname;
            (hubspot_obj.properties.deal_category =
              data.data.metadata?.dealCategory);
          //hubspot_obj.properties.deal_source =data.data.metadata?.dealSource;
          hubspot_obj.properties.description = data.data.metadata?.description;
          hubspot_obj.properties.developer = data.data.metadata?.developer;
          hubspot_obj.properties.hubspot_owner_id =
            ownerID === undefined ? null : ownerID;
          hubspot_obj.properties.pipeline = "default";
          hubspot_obj.properties.price_from = data.data.buying?.priceFrom;
          hubspot_obj.properties.price_to = data.data.buying?.priceTo;
          hubspot_obj.properties.active = data.data.active;
          hubspot_obj.properties.project_name =
            data.data?.metadata?.projectName;
          hubspot_obj.properties.reason_for_looking =
            data.data?.metadata?.reasonForLooking;
          hubspot_obj.properties.future_prospecting_timeframe =
            data.data?.metadata?.futureProspectingTimeframe;
          hubspot_obj.properties.archived_status = data.data.fromArchive;

          if (
            data.data.locationType == "areas" &&
            Array.isArray(data.data.locationOptions)
          ) {
            if (Array.isArray(data.data["_embedded"]["areas"])) {
              var community = [];
              var sub_community = [];

              for (var area of data.data["_embedded"]["areas"]) {
                if (Array.isArray(area.parentIds)) {
                  sub_community.push(area.name);
                } else {
                  community.push(area.name);
                }
              }
              var comm = community.join(";");
              var sub_comm = sub_community.join(";");

              hubspot_obj.properties.community = comm;
              hubspot_obj.properties.sub_community = sub_comm;
            }
          }
          if (!(data.data.source == null || data.data.source == undefined)) {
            if (data.data["_embedded"]["source"]) {
              hubspot_obj.properties.deal_source =
                data.data._embedded.source.name;
            }
          }

          if (data.data.statusId == "UQ")
            console.log("status is UQ therefore not updating in HS");
          else if (data.data.statusId == "GE")
            hubspot_obj.properties.qualfication_status = "Warm";
          else if (data.data.statusId == "HO")
            hubspot_obj.properties.qualfication_status = "Hot";
          else if (data.data.statusId == "CO")
            hubspot_obj.properties.qualfication_status = "Cold";

          var date = new Date();
          var nextCallDate = new Date(data.data.nextCall);
          if (
            !(data.data.nextCall == undefined || data.data.nextCall == null)
          ) {
            var diff = nextCallDate.getTime() - date.getTime();
            var diffInMonths = diff / (1000 * 60 * 60 * 24 * 30);
            hubspot_obj.properties.future_prospecting_date = nextCallDate;
            if (diffInMonths > 3) {
              hubspot_obj.properties.future_prospecting_date = nextCallDate;
              hubspot_obj.properties.dealstage = "134502348";
              hubspot_obj.properties.qualfication_status = undefined;
            } else {
              hubspot_obj.properties.future_prospecting_date = nextCallDate;
            }
          }

          Object.keys(hubspot_obj.properties).forEach((key) => {
            if (
              hubspot_obj.properties[key] === undefined ||
              hubspot_obj.properties[key] === null
            ) {
              delete hubspot_obj.properties[key];
            }
          });

          updateHubspotDealsData.push(hubspot_obj);
        }
      } else {
        const hd_obj = hubspotDealsObj(data.data);

        if (
          data.data.locationType == "areas" &&
          Array.isArray(data.data.locationOptions)
        ) {
          if (Array.isArray(data.data["_embedded"]["areas"])) {
            var community = [];
            var sub_community = [];

            for (var area of data.data["_embedded"]["areas"]) {
              if (Array.isArray(area.parentIds)) {
                sub_community.push(area.name);
              } else {
                community.push(area.name);
              }
            }

            var comm = community.join(";");
            var sub_comm = sub_community.join(";");
            hd_obj.properties.community = comm;
            hd_obj.properties.sub_community = sub_comm;
          }
        }

        if (!(data.data.source == null || data.data.source == undefined)) {
          if (data.data["_embedded"]["source"]) {
            hd_obj.properties.deal_source =
              data.data["_embedded"]["source"]["name"];
          }
        }

        if (data.data.statusId == "GE") {
          hd_obj.properties.dealstage = "134449907";
          hd_obj.properties.qualfication_status = "Warm";
        } else if (data.data.statusId == "HO") {
          hd_obj.properties.dealstage = "134449907";
          hd_obj.properties.qualfication_status = "Hot";
        } else if (data.data.statusId == "CO") {
          hd_obj.properties.dealstage = "134449907";
          hd_obj.properties.qualfication_status = "Cold";
        } else if (data.data.statusId == "UQ") {
          hd_obj.properties.dealstage = "134449902";
        }

        var date = new Date();
        var nextCallDate = new Date(data.data.nextCall);
        if (!(data.data.nextCall == undefined || data.data.nextCall == null)) {
          var diff = nextCallDate.getTime() - date.getTime();
          var diffInMonths = diff / (1000 * 60 * 60 * 24 * 30);

          if (diffInMonths > 3) {
            hd_obj.properties.future_prospecting_date = nextCallDate;
            hd_obj.properties.dealstage = "134502348";
            hd_obj.properties.qualfication_status = undefined;
          } else {
            hd_obj.properties.future_prospecting_date = nextCallDate;
          }
        }

        hd_obj.properties.client_type = client_type.join(";");
        hd_obj.properties.hubspot_owner_id =
          ownerID === "" ? "707859911" : ownerID;
        const createDeal = await createNewDeal(hd_obj);

        if (createDeal.id) {
          console.log(createDeal, "deal created :_________");
          // *******Contact Mapping**********
          var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          for (var contact of data.data.related) {
            // console.log(contact)
            var contactById = await fetchRoleInContact(contact.id);
            var contactOwnerId = "";

            if (
              contactById &&
              contactById.negotiators &&
              contactById.negotiators.length > 0
            ) {
              for (var negotiator of contactById.negotiators) {
                var findMatch = ownersMap[negotiator.email];
                if (findMatch) {
                  contactOwnerId = findMatch;
                } else {
                  contactOwnerId = "707859911";
                }
              }
            } else {
              contactOwnerId = "707859911";
            }
            var sourceOfContact = "";
            if (contactById.source) {
              sourceOfContact = contactById.source.name;
            }

            var matchForHubspot = false;

            var hubspotContact =
              (await searchFunction("contacts", "email", contact.email)) ||
              (await searchFunction(
                "contacts",
                "mobilephone",
                contact.mobilePhone
              ));
            if (hubspotContact.id) matchForHubspot = true;

            if (matchForHubspot) {
              const createAssociationBetweenDealAndContact =
                await createAssociation(createDeal.id, hubspotContact.id);

              const updateIDInHubspot = await updateContactInHubspot({
                id: hubspotContact.id,
                data: {
                  properties: {
                    reapit_contact_id: contact.id,
                    client_type: client_type?.join(";"),
                  },
                },
              });
            } else {
              var contactSchema = {
                properties: {
                  email: contact.email,
                  firstname: contact.forename,
                  lastname: contact.surname,
                  date_of_birth: contact.dateOfBirth,
                  phone: contact.workPhone,
                  mobilephone: contact.mobilePhone,
                  reapit_contact_id: contact.id,
                  home_phone_number: contact.homePhone,
                  archived: "False",
                  pipeline: "default",
                  client_type: client_type.join(";"),
                  hubspot_owner_id: contactOwnerId,
                  contact_source: sourceOfContact,
                },
              };

              if (!contact.email && contact.mobilePhone) {
                const randomSeries =
                  Math.floor(Math.random() * 900000) + 100000;
                contactSchema.properties.email = `${contact.mobilePhone.replace(
                  /[()\-\s]/g,
                  ""
                )}_${randomSeries}@hnh.com`;
              }
              console.log(contactSchema);

              const createNew = await createNewContact(contactSchema);
              console.log(
                createNew.id === undefined ? createNew : createNew?.id,
                createDeal.id
              );
              const newAssociation = await createAssociation(
                createDeal.id,
                createNew.id === undefined ? createNew : createNew?.id
              );
            }
          }
          newHubspotDealsData.push(hd_obj);
        } else {
          console.log("Error in creating deal due to validation error");
        }
      }
    }

    return {
      transferToHubspotDeals: transferToHubspotDeals,
      newHubspotDealsData: newHubspotDealsData,
      updateHubspotDealsData: updateHubspotDealsData,
    };
  } catch (error) {
    console.log(error);
    return error;
  }
}

// *---------------------------------------------------------------------------------------
// * Function to sync Reapit Contacts to Hubspot Contacts via webhooks.
// * Optimized 
async function reapitContactToHubpotViaWebhooks(WEBHOOK_BODY){
    
    try {
        console.log("Contact creation/updation in Hubspot via webhooks initialized!!");
        const reapitContact = WEBHOOK_BODY.new

        // const contacts = await fetchContactsFromHubspot();
        const sources = await fetchAllSources();
        const owners = await fetchOwnersFromHubspot();

        var ownersMap = {}
        for(var owner of owners){
            ownersMap[owner.email] = owner.id;
        }

        var sourcesMap = {};
        for (var source of sources) {
            sourcesMap[source.name] = source.id;
        }

        // var hubspotContactsSet = new Set();
        // for (var contact of contacts) {
        //     if (contact.properties.email) {
        //         var email = contact.properties?.email.toLowerCase().trim()
        //         // console.log(typeof(email))
        //         hubspotContactsSet.add(email);
        //     }
        //     if (contact.properties.mobilephone) {
                
        //         hubspotContactsSet.add(contact.properties.mobilephone);
        //     }
        // }

        if(WEBHOOK_BODY.topicId == "contacts.created" && reapitContact){
            console.log("contacts.created conditon satisfied.");
            var contactMatchInHubspot = false;
            
            var email = reapitContact?.email?.toLowerCase()?.trim()
            // if (
            //     hubspotContactsSet.has(email) ||
            //     hubspotContactsSet.has(reapitContact.mobilePhone)
            // ) {
            //     contactMatchInHubspot = true;
            // }

            var hubspotContact = await searchFunction("contacts", "email", email) || await searchFunction("contacts", "mobilephone", reapitContact?.mobilePhone);
            if(hubspotContact.id) contactMatchInHubspot = true
            
            
            if(contactMatchInHubspot){
                console.log("Contact already present in Hubspot.");
                return "Contact already present in Hubspot.";
            }else{

                var relationship = await fetchRoleInContact(reapitContact.id);
                var relationships = relationship.relationships;
                var negotiators = relationship.negotiators;
                var role_source = relationship.source;

                const schema = hubspotContactsObj(reapitContact);
                var client_type = [];
                if(Array.isArray(relationships) && relationships.length > 0){
                    for(var rel of relationships){
                        client_type.push(rel.associatedType)
                    }
                    schema.properties.client_type = client_type.join(";")
                }

                if(Array.isArray(negotiators) && negotiators.length > 0){
                    for(var neg of negotiators){
                        
                        var ownerId = ownersMap[neg.email]
                        
                        if(ownerId){
                            schema.properties.hubspot_owner_id = ownerId
                        }else{
                            schema.properties.hubspot_owner_id = "707859911";
                        }
                    }
                }

                if(role_source){
                    schema.properties.contact_source = role_source.name;
                }

                if(reapitContact.officeIds){
                    schema.properties.officeids = reapitContact.officeIds.join(";")
                }

                if(!reapitContact.email && reapitContact.mobilePhone){
                    const randomSeries = Math.floor(Math.random() * 900000) + 100000
                    schema.properties.email = `${reapitContact.mobilePhone.replace(/[()\-\s]/g, "")}_${randomSeries}@hnh.com`
                }

                // *checking if object contains undefined or null
                Object.keys(schema.properties).forEach(key => {
                    if (schema.properties[key] === undefined || schema.properties[key] === null) {
                      delete schema.properties[key];
                    }
                });

                // * ----------------------------------------------
                console.log(schema);
                const contactToCreate = await createNewContact(schema);
                console.log(`Contact created for this reapit contact: ${reapitContact.id}`);
                return `Contact created for this reapit contact: ${reapitContact.id}`;
            }
        }else if(WEBHOOK_BODY.topicId == "contacts.modified" && reapitContact){

            console.log("contacts.modified condition satisfied.");

            var contactMatchInHubspot = false;
            var hubspotContactId = ""
            // for(var contact of contacts){
            //     if(contact.properties.reapit_contact_id == reapitContact.id){
            //         contactMatchInHubspot = true;
            //         hubspotContactId = contact.id;
            //         break;
            //     }
            // }

            var hubspotContact = await searchFunction("contacts", "reapit_contact_id", reapitContact.id)
            if(hubspotContact.id) {
                contactMatchInHubspot = true
                hubspotContactId = hubspotContact.id
            }
            
            if(contactMatchInHubspot){
                //console.log(hubspotContactId);
                var relationship = await fetchRoleInContact(reapitContact.id);
                var relationships = relationship.relationships;
                var negotiators = relationship.negotiators;
                var role_source = relationship.source;

                const schema = hubspotContactsObj(reapitContact);
                var client_type = [];
                if(Array.isArray(relationships) && relationships.length > 0){
                    for(var rel of relationships){
                        client_type.push(rel.associatedType)
                    }
                    schema.properties.client_type = client_type.join(";")
                }

                if(Array.isArray(negotiators) && negotiators.length > 0){
                    for(var neg of negotiators){
                        var ownerId = ownersMap[neg.email]

                        if(ownerId){
                            schema.properties.hubspot_owner_id = ownerId
                        }else{
                            schema.properties.hubspot_owner_id = "707859911";
                        }
                    }
                }

                if(role_source){
                    schema.properties.contact_source = role_source.name;
                }

                if(reapitContact.officeIds){
                    schema.properties.officeids = reapitContact.officeIds.join(";")
                }

                if (!reapitContact.email && reapitContact.mobilePhone) {
                    const randomSeries = Math.floor(Math.random() * 900000) + 100000;
                    schema.properties.email = `${reapitContact.mobilePhone.replace(
                      /[()\-\s]/g,
                      ''
                    )}_${randomSeries}@hnh.com`;
                }

                // *checking if object contains undefined or null
                Object.keys(schema.properties).forEach(key => {
                    if (schema.properties[key] === undefined || schema.properties[key] === null) {
                      delete schema.properties[key];
                    }
                });

                // * ----------------------------------------------

                const updateBody = {
                    id: hubspotContactId,
                    data: schema
                }
                console.log(updateBody);
                const makeUpdateInHubspot = await updateContactInHubspot(updateBody)
                console.log(`Contact updated for this reapit contact: ${reapitContact.id}`);
                return `Contact updated for this reapit contact: ${reapitContact.id}`;
            }else{
                console.log("No match found in hubspot");
                return
            }
        }else{
            console.log("Invalid topic id fetched.");
            return 
        }
    } catch (error) {
        console.log(error);
        return error;
    }
}

// *---------------------------------------------------------------------------------------
// * Function to sync existing Reapit Contacts to Hubspot Contacts.
// * reduced time complexity from O(n^2) to O(n) takes 15+ minutes approx.

async function existingReapitContactsToHubspot(){

    try {
        
        console.log("Migration of existing Reapit contacts to Hubspot function initialised!!");
        
        // const data = fs.readFileSync('reapitContacts.json')
        // const reapitContactsBase = JSON.parse(data)
        // console.log(reapitContactsBase.length)

        const data = fs.readFileSync('archiveContactsBase.json')
        const reapitContactsBase = JSON.parse(data)
        console.log(reapitContactsBase.length)
        
        const owners = await fetchOwnersFromHubspot();

        const sources = await fetchAllSources();

        // const tttois = await fetchContactsFromHubspot()
        
        // const hsdata = fs.readFileSync('hsContactsDump.json');

        const hubspotContacts = await fetchContactsFromHubspot()
        console.log(hubspotContacts.length)

        var ownersMap = {};
        for(var owner of owners){
            ownersMap[owner.email] = owner.id
        }

        var sourcesMap = {};
        for(var source of sources){
            sourcesMap[source.name] = source.id;
        }
    
        var hubspotContactsSet = new Set();
        for (var contact of hubspotContacts) {
            if (contact.properties.email) {
                var email = contact.properties?.email.toLowerCase().trim()
                // console.log(typeof(email))
                hubspotContactsSet.add(email);
            }
            if (contact.properties.mobilephone) {
                
                hubspotContactsSet.add(contact.properties.mobilephone);
            }
        }
        //console.log(hubspotContactsSet);
        
        var count = 0
        var createBatch = []
        var foulBatch = []

        async function findMatch(contact){

            var email = contact.data?.email?.toLowerCase()?.trim()
            if (
                hubspotContactsSet.has(email) ||
                hubspotContactsSet.has(contact.data.mobilePhone)
            ) {
                
                return true
            } else{

                return false
            }

        }

        
        await Promise.all(
            reapitContactsBase.map(async reapit_contact => {

                var matchInHubspot = true
                matchInHubspot = await findMatch(reapit_contact);

                
                // if (
                //     hubspotContactsSet.has(reapit_contact.data.email) ||
                //     hubspotContactsSet.has(reapit_contact.data.mobilePhone)
                // ) {
                //     // console.log(hubspotContactsSet.has("guillem@grosaleny.com"), "******")
                //     // console.log(reapit_contact.data.email === "guillem@grosaleny.com", "*****")
                //     matchInHubspot = true;
                // }else{
                //     hubspotContactsSet.
                // }
        
                if(matchInHubspot){
                    count ++  
                    console.log(`Contact already exists in Hubspot | reapit_contact: ${reapit_contact.data.id} count: ${count}`);
                }else{

                    
                    // create new contact in hubspot
                    var relationship = reapit_contact.data._embedded// await fetchRoleInContact(reapit_contact.data.id);
                    var relationships = relationship.relationships;
                    var negotiators = relationship.negotiators;
                    var role_source = relationship.source;
        
                    const schema = hubspotContactsObj(reapit_contact.data);
                    var client_type = [];
                    if(Array.isArray(relationships) && relationships.length > 0){
                        for(var rel of relationships){
                            client_type.push(rel.associatedType)
                        }
                        schema.properties.client_type = client_type.join(";")
                    }
        
                    if(Array.isArray(negotiators) && negotiators.length > 0){
                        for(var neg of negotiators){
                            
                            var ownerId = ownersMap[neg.email]
                            if(ownerId){
                                schema.properties.hubspot_owner_id = ownerId
                            }else{
                                schema.properties.hubspot_owner_id = "707859911";
                            }
                        }
                    }else{
                        schema.properties.hubspot_owner_id = "707859911";
                    }
        
                    if(role_source){
                        schema.properties.contact_source = role_source.name;
                    }

                    // if(reapit_contact.data.officeIds.includes("LEA")){
                    //     schema.properties.pipeline = "leasing";
                    // }
                    if(reapit_contact.data.officeIds){
                        schema.properties.officeids = reapit_contact.data.officeIds.join(";")
                    }

                    if(!reapit_contact.data.email && reapit_contact.data.mobilePhone){
                        const randomSeries = Math.floor(Math.random() * 900000) + 100000
                        schema.properties.email = `${reapit_contact.data.mobilePhone.replace(/\s/g, "")}_${randomSeries}@hnh.com`
                    }
        
                    // *checking if object contains undefined or null
                    Object.keys(schema.properties).forEach(key => {
                        if (schema.properties[key] === undefined || schema.properties[key] === null) {
                            delete schema.properties[key];
                        }
                    });

                    function containsEmail(batchArray, email){
                        for(const batch of batchArray){
                            if(batch.properties && batch.properties.email === email){
                                return true
                            }
                        }
                        return false
                    }

                    function validateEmail(email){
                        const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
                        const multipleComPattern = /\.com.*\.com/;
                        const cimCheck = /\.cim/
                        const conCheck = /\.con/;
                        return emailPattern.test(email) && !multipleComPattern.test(email) && !cimCheck.test(email) && !conCheck.test(email);
                    }

                    function containsMobilePhone(batchArray, number){
                        for(const batch of batchArray){
                            if(batch.properties && batch.properties.mobilephone === number){
                                return true
                            }
                        }
                        return false
                    }

                    function containsLastname(batchArray, lastname){
                        for(const batch of batchArray){
                            if(batch.properties && batch.properties.lastname === lastname){
                                return true
                            }

                        }
                        return false
                    }

                    
                    if(
                        (schema.properties.email || schema.properties.mobilephone) && 
                        !containsEmail(createBatch, schema.properties.email) &&
                        validateEmail(schema.properties.email) 
                    ){
                        count ++
                        createBatch.push(schema)
                    } else{
                        count ++ 
                        console.log(`Due to invalid email, this contact could not get created ${reapit_contact.data.id} count: ${count}`)
                        foulBatch.push({
                            id: reapit_contact.data?.id,
                            email: reapit_contact.data?.email,
                            manipulatedEmail: schema.properties?.email,
                            mobilePhone: reapit_contact.data?.mobilePhone
                        })
                    }
        
                    // * ----------------------------------------------
                    // console.log(schema);
                    
                    // if(createBatch.length = 10){
                    //     console.log(createBatch)
                    //     const batchCreate = await createBulkContacts(createBatch)
                    //     // createBatch = []
                    // }
                    // const contactToCreate = await createNewContact(schema);
                    console.log(`Contact processed, reapit_contact: ${reapit_contact.data.id}, count: ${count}`)
                    //console.log(`Contact created for this reapit contact: ${reapit_contact.data.id}`);
                    //return `Contact created for this reapit contact: ${reapit_contact.data.id}`;   
                }
            })
        )
            
        fs.writeFileSync('foulBatch.json', JSON.stringify(foulBatch))
        console.log(foulBatch.length)
        console.log(createBatch.length)
        await createBulkContacts(createBatch)
        console.log("Transfered all existing reapit contacts to hubspot contacts.");
        return 1;
    } catch (error) {
        console.log(error);
        return;
    }
}

// *---------------------------------------------------------------------------------------
// * Function to sync Hubspot Contacts to Reapit Contacts.
// ** reduced O(n^2) to O(n) time complexity and reduced Api call to fetch deal owner by id.
// ! still taking 20+ minutes.

// * loop takes only 6-7 minutes but posting/patching takes time
// ! modify contact match condition.

//############### THIS IS TO BE DEBUGGED>> NOT HAPENNG AT ALL #################
//27th March 2024
// SYNC the landlords info like the NEGOTIATORS INFO
async function hubspotContactsToReapit() {
    try {
      console.log("Migration of HubSpot contacts to Reapit function initialized.");
      const [hubspotContacts, negotiators, owners, sources] = await Promise.all([
        fetchContactsFromHubspot(),
        negotiatorsData(),
        fetchOwnersFromHubspot(),
        fetchAllSources()
      ]);
  
      const ownersMap = owners.reduce((map, owner) => {
        map[owner.id] = owner.email;
        return map;
      }, {});
  
      const negotiatorsMap = negotiators.reduce((map, negotiator) => {
        map[negotiator.email] = negotiator;
        return map;
      }, {});

      var sourcesMap = {};
      for(var source of sources){
        sourcesMap[source.name] = source.id;
      }
  
      var updateBatch = []; // NO PROPERTIES ENTETRED COULD BE REASON FOR OWNER SYNC FAILER - check it
      var createBatch = [];
      var noChangeBatch = []
      
      const tempData = hubspotContacts.slice(1,250)
      
      await Promise.all(
        hubspotContacts.map(async (contact) => {
          var flag = true;
          var filterType = {
            mobile: true,
            email: true
          }

          if(!contact.properties?.email && !contact.properties?.mobilephone){
            flag = false
          }

          if(!contact.properties?.email){
            filterType.email = false
          } 

          if(!contact.properties?.mobilephone){
            filterType.mobile = false
          }
          var matchQuery = {}

          if(filterType.email == true && filterType.mobile == false){
            matchQuery = {
            "data.email": contact.properties.email
            }
          }

          if(filterType.mobile == true && filterType.email == false){
            matchQuery = {
            "data.mobilePhone": contact.properties.mobilephone
            }
          }

          if(filterType.email == true && filterType.mobile == true){
            matchQuery = {
                $or: [
                    { "data.email": contact.properties.email },
                    { "data.mobilePhone": contact.properties.mobilephone }
                ]
            }
          }

          console.log(matchQuery)

          if(flag){

            var contactInReapit = null

            const contactsInReapit = await Contacts.find(matchQuery);
            console.log(contactsInReapit);

            if(contactsInReapit.length === 1) contactInReapit = contactsInReapit[0]
            else if(contactsInReapit.length > 1){

                var nameFilter = contactsInReapit.filter(cont => {
                    const dataForename = cont.data?.forename;
                    const dataSurname = cont.data?.surname;
                    const propertiesFirstname = contact.properties?.firstname;
                    const propertiesLastname = contact.properties?.lastname;
                  
                    return (
                      (dataForename === propertiesFirstname || (!dataForename && !propertiesFirstname)) &&
                      (dataSurname === propertiesLastname || (!dataSurname && !propertiesLastname))
                    );
                });
                // var nameFilter = contactsInReapit.filter(cont => cont.data?.forename === contact.properties?.firstname && cont.data?.surname === contact.properties?.lastname)
                if(nameFilter.length === 1) contactInReapit = nameFilter[0]
                else if(nameFilter.length > 1){
                    var activeContact = contactsInReapit.filter(cont => cont.data.active)
                    if(activeContact.length === 1) contactInReapit = activeContact[0]
                    else if(activeContact.length > 1){
                        var mostRecentData = activeContact.reduce((prev,current) => {
                            return (prev.data.modified > current.data.modified) ? prev : current;
                        })

                        contactInReapit = mostRecentData
                    } else{
                        var modifiedFilter = contactsInReapit.reduce((prev,current) => {
                            return (prev.data.modified > current.data.modified) ? prev : current;
                        })

                        contactInReapit = modifiedFilter
                    }
                }
            }

            // console.log(contactInReapit)
            //################# CHECK THE BELOW UPDATE FOR OWNER ID #################
            // if there is a change of owner in HS.. then update it in RT 
            // if no owner in HS, update ROP as the owner 
            // in the update batch.. the props

            let negotiatorID = "";
            if (contact.properties.hubspot_owner_id) {
                const dealOwnerDetail = ownersMap[contact.properties.hubspot_owner_id];
                console.log(`Fetch Deal Owner By Id function called: ${dealOwnerDetail}`);
    
                const negData = negotiatorsMap[dealOwnerDetail];
    
                negotiatorID = negData ? negData.id : "ROP";  // detault ROP owner
            } else {
                negotiatorID = "ROP"; // detault ROP owner
            }
            //########################################################################
            //############# DO THE 2604 to 2614 logic for LANDLORDS update too #######
            //what is landlords called in HS? Contacts in HS becomes landlords in RT
            //########################################################################
            var contactSource = {
                id: "",
                type: "source"
            }
    
            if(!(contact.properties.contact_source == undefined || contact.properties.contact_source == null || contact.properties.contact_source == "")){
                var sourceData = sourcesMap[contact.properties.contact_source];
                
                if(sourceData){
                    contactSource.id = sourceData
                }else{
                    // create new source in reapit and then take that id.
                    var sourceSchema = {
                        name: contact.properties.contact_source,
                        type: "source",
                        officeIds: null,
                        departmentIds: null
                    }
    
                    var newSource = await createNewSource(sourceSchema);
                    contactSource.id = newSource
                }
            }

            const schema = reapitContactObj(contact);
            schema.negotiatorIds.push(negotiatorID);
            if(contactSource.id) schema.source = contactSource;

            if(contact.properties.officeids){
                schema.officeIds = []
                schema.officeIds = contact.properties.officeids.split(";")
            }
    
            Object.keys(schema).forEach((key) => {
              if (schema[key] === undefined || schema[key] === null) {
                delete schema[key];
              }
            });
    
            //################ CHECK THE CONDITIONS IF THEY ARE POPULATING UPDATEBATCH AS REQUIRED ###########
            if (contactInReapit) {
              const reapitTimestamp = new Date(contactInReapit.data.modified);
              const hubspotTimestamp = new Date(contact.properties.lastmodifieddate);
              // console.log(contactInReapit.data.modified, contact.properties.lastmodifieddate);
              if (contactInReapit.data.modified > contact.properties.lastmodifieddate) {
                console.log(`No change done in Reapit contact: ${contactInReapit.data.id}`);
                noChangeBatch.push(contactInReapit.data.id)
              } else {

                if(contact.properties.hubspot_owner_id === "707859911"){  //if owner id is Raizul then don't update the owner
                    delete schema.negotiatorsIds  //key-val pair is present in updatebactch -- check it
                }
                updateBatch.push({
                  id: contactInReapit.data.id,
                  eTag: contactInReapit.data._eTag,
                  data: schema
                });
              }
            } else {
                // if(contact.properties.pipeline === "leasing"){
                //     schema.officeIds = []
                //     schema.officeIds.push("LEA");
                // }
                
                createBatch.push(schema);
            }
          } else{
            console.log("flag was false since contact doesnot had either email or mobilephone")
          }
            
        })
      );
  
      return {
        updateBatch,
        createBatch,
        noChangeBatch
      };
    } catch (error) {
      console.log(error);
      return error;
    }
}

// *----------------------------------------------------------------------------------------
// * Function to sync Reapit Contacts Journals to Hubspot Contacts Notes.
// ***** Introduced map data structure that reduced the time complexity greatly
async function contactJournal2Note(){

    try {
        
        console.log("----------------Contact Journal 2 Notes function initialized.-----------------");
        
        const [
            // contacts, 
            owners, 
            negotiators
        ] = await Promise.all([
            // fetchContactsFromHubspot(),
            fetchOwnersFromHubspot(),
            negotiatorsData()
        ]);
        
        
        const negotiatorsMap = {}
        for(var negotiator of negotiators){
            negotiatorsMap[negotiator.id] = negotiator.email;
        }

        const ownersMap = owners.reduce((map, owner) => {
            map[owner.email] = owner;
            return map;
        }, {});
        //const contactsSet = new Set(contacts.map(contact => contact.email));
        const data = fs.readFileSync('hsContactsDump.json')
        const contacts = JSON.parse(data)
        console.log(contacts.length)
        

        var tempData = contacts.slice(135000)
        var count = 0 
        for(var contact of tempData){

            if(contact.properties.reapit_contact_id){

                const journals = await fetchApplicantJournal(contact.properties.reapit_contact_id)
    
                var createBatch = []
                if(Array.isArray(journals) && journals.length > 0){
                    const notes = await fetchNotesForContact(contact.id);
    
                    if(Array.isArray(notes) && notes.length > 0){
                        for(var journal of journals){
                            const desc = convert(journal.description, { wordwrap: 130 })
                            const noteExists = notes.some(note => 
                                convert(note.properties.hs_note_body, { wordwrap: 130 }) === desc    
                            )
    
                            if(noteExists){
                                console.log("Note already exists with same description.");
                            } else{
                                var ownerId = ""
                                if(journal.negotiatorId){
                                    var negotiator = negotiatorsMap[journal.negotiatorId] // await fetchNegotiatorById(journal.negotiatorId);
                                    if(!negotiator){
                                        ownerId = "707859911";
                                        console.log("Owner id set to default value i.e Raizul");
                                    }else{
    
                                        var hubspotOwner = ownersMap[negotiator];
                                        if(hubspotOwner){
                                            ownerId = hubspotOwner.id;
                                            console.log(`Owner id mapped: ${ownerId}`);
                                        }else{
                                            ownerId = "707859911";
                                            console.log("Owner set to Raizul since no match found in deal owners.");
                                        }
                                    }
                                }
    
                                var properties = {
                                    "hs_timestamp": journal.created,
                                    "hs_note_body": desc,
                                    "hubspot_owner_id": ownerId
                                }
                                var noteBody = {
                                    properties ,
                                    associations: [{"to":{"id":contact.id},"types":[{"associationCategory":"HUBSPOT_DEFINED","associationTypeId":10}]}]
                                }
                                
                                createBatch.push(noteBody)
                            }
                        }
                        console.log(`Contact processed: ${contact.id} | count: ${count}`)
                        count ++
                    } else{
                        for(var journal of journals){
                            var ownerId = ""
                            if(journal.negotiatorId){
                                var negotiator = negotiatorsMap[journal.negotiatorId]// await fetchNegotiatorById(journal.negotiatorId);
                                if(!negotiator){
                                    ownerId = "707859911";
                                    console.log("Owner id set to default value i.e Raizul");
                                }else{
    
                                    var hubspotOwner = ownersMap[negotiator];
                                    if(hubspotOwner){
                                        ownerId = hubspotOwner.id;
                                        console.log(`Owner id mapped: ${ownerId}`);
                                    }else{
                                        ownerId = "707859911";
                                        console.log("Owner set to Raizul since no match found in deal owners.");
                                    }
                                }
                            }
    
                            var properties = {
                                "hs_timestamp": journal.created,
                                "hs_note_body": journal.description,
                                "hubspot_owner_id": ownerId
                            }
                            var noteBody = {
                                properties ,
                                associations: [{"to":{"id":contact.id},"types":[{"associationCategory":"HUBSPOT_DEFINED","associationTypeId":10}]}]
                            }
    
                            createBatch.push(noteBody)
                        }

                        console.log(`Contact processed.... ${contact.id} | count: ${count}`)
                        count ++
                    }
                }else{

                    console.log("No contact match or journals are not present.", count);
                    count ++
                }
                console.log(createBatch.length);
                if(createBatch.length > 0){
                    // for(var note of createBatch){
                    //     await createNote(note)
                    // }
                    await createBatchNote(createBatch)
                }
            }
        }
        
    
        console.log("contactJournal2Note finished executing.");
        return 1
    } catch (error) {
        console.log(error);
        return error
    }
}

async function updateRoleInHubspot(){

    // const tempData1 = await fetchContactsFromHubspot()
    
    // const data = fs.readFileSync('hsContactsDump.json');
    // const hsContacts = JSON.parse(data)
    // console.log(hsContacts.length)
    // const filteredContacts = hsContacts.filter(contact => !contact.properties.client_type)
    // console.log(filteredContacts.length)
    // // return
    // const updateBatch = []
    // var blankRelationships = []


    var data = fs.readFileSync('newContacts.json')

    var jsonData = JSON.parse(data)
    // fs.createReadStream('C:/Users/Admin/Downloads/newContacts.csv')
    // .pipe(csv())
    // .on('data', (row) => {
    //     jsonData.push(row)
    // })
    // .on('end', () => {
    //     console.log(jsonData)
    //     fs.writeFileSync('newContacts.json', JSON.stringify(jsonData))
        
    // })

    const owners = await fetchOwnersFromHubspot();
    var ownersMap = {};
    for(var owner of owners){
        ownersMap[owner.email] = owner.id
    }
    
    var updateBatch = []
    var blankRelationships = []
    console.log(jsonData.length)
    
    var tempData = jsonData.slice(5001)

    var batchedTempData = []
    for(let i = 0; i < tempData.length; i+=4){
        batchedTempData.push(tempData.slice(i, i+4))
    }
    var count = 1
    for(var batch of batchedTempData){
        await Promise.all(
            batch.map(async (contact) => {
                if(contact["Reapit Contact ID"]){
                    const relationship = await fetchRelationshipsInContact(contact["Reapit Contact ID"])
                    // console.log(relationship)
                    var relationships = relationship._embedded;
                    console.log(Array.isArray(relationships) && relationships.length > 0)
                    console.log(relationships)
                    var client_type = []
                    if(Array.isArray(relationships) && relationships.length > 0){
                        console.log("Adding client types now.");
                        for(var role of relationships){
                            client_type.push(role.associatedType);
                        }
                    }else{
                        blankRelationships.push({
                            id: contact["Reapit Contact ID"],
                            relationships: 0
                        })
                        console.log("Relationships must not be an array or of length 0");
                    }
                    
                    var uniqueRoles = [...new Set(client_type)]
                    updateBatch.push({
                        "id": contact["Record ID"],
                        "properties": {
                            client_type: uniqueRoles.join(";")
                        }
                    })
                    console.log(`Contact processed: ${contact["Reapit Contact ID"]} || count: ${count}`)
                    count ++
                }
            })
        )
    }

    console.log("Blank relationships: ", blankRelationships.length)
    console.log("Update batch size",updateBatch.length)
    console.log(updateBatch)
    
    if(updateBatch.length > 0){
        await updateBulkContacts(updateBatch)
    }
}

async function contactNotes2Journals(){

    try {
        
        console.log('Contact notes 2 journals started.');
    
        const [deals, owners, reapit_contacts, negotiators] = await Promise.all([
            fetchDealsFromHubspot(),
            fetchOwnersFromHubspot(),
            Contacts.find().then((contacts) => (contacts.length === 0 ? contactsData() : contacts)),
            negotiatorsData()
        ]);
    
        var ownersMap = {};
        for(var owner of owners){
            ownersMap[owner.id] = owner.email
        }
    
        var negotiatorsMap = {}
        for(var negotiator of negotiators){
            negotiatorsMap[negotiator.email] = negotiator.id
        }
    
        console.log('Entering to note2journal sync loop...');
        var contactChecked = []
        for (var data of deals) {
            console.log(`Processing deal: ${data.id}`);
    
            var contactDetails = [];
            
            if(data.associations && data.associations.contacts) {
                // extract contact details from that contact
                for (var acontact of data.associations.contacts.results) {
                    if(contactChecked.includes(acontact.id)){
                        console.log("this contact is already looped.");
                    }else{
                        const details = await fetchContactById(acontact.id);
                        contactDetails.push(details)
                        contactChecked.push(acontact.id)
                    }
                }
            } else {
                console.log("No contact associated to deal: ", data.id);
            }
    
            for(var singleContact of contactDetails){

                var flag = true;
                var filterType = {
                    mobile: true,
                    email: true
                }

                if(!singleContact.properties?.email && !singleContact.properties?.mobilephone){
                    flag = false
                }

                if(!singleContact.properties?.email){
                    filterType.email = false
                } 

                if(!singleContact.properties?.mobilephone){
                    filterType.mobile = false
                }

                var matchQuery = {}

                if(filterType.email == true && filterType.mobile == false){
                    matchQuery = {
                        "data.email": singleContact.properties.email
                    }
                }
    
                if(filterType.mobile == true && filterType.email == false){
                    matchQuery = {
                        "data.mobilePhone": singleContact.properties.mobilephone
                    }
                }

                if(filterType.email == true && filterType.mobile == true){
                    matchQuery = {
                        $or: [
                            { "data.email": singleContact.properties.email },
                            { "data.mobilePhone": singleContact.properties.mobilephone }
                        ]
                    }
                }

                if(flag){

                    const reap_contact = await Contacts.findOne(matchQuery);
    
                    if(!reap_contact){
                        console.log("No match found in Reapit contacts.");
                        continue;
                    }
        
                    const notes = await fetchNotesForContact(singleContact.id);
    
                    if(!Array.isArray(notes) || notes.length === 0){
                        console.log("No notes found associated with contact: ", singleContact.id);
                        continue;
                    }
    
                    const journals = await fetchApplicantJournal(reap_contact.data.id);
                    if(!Array.isArray(journals) || journals.length === 0){
                        for(var note of notes){
        
                            var negotiator_id = ""
                            const dealOwner = ownersMap[note.properties.hubspot_owner_id]
                            if(!dealOwner){
                                negotiator_id = null
                                //console.log("No deal owner associated.");
                            }else{
                                var neg = negotiatorsMap[dealOwner];
                                if(neg){
                                    negotiator_id = neg
                                    //console.log(`negotiator id mapped: ${negotiator_id}`);
                                }else{
                                    negotiator_id = null;
                                }
                            }
                            const desc = convert(note.properties.hs_note_body, { wordwrap: 130 });
                            const journal = await createJournal({
                                associatedType: "contact",
                                associatedId: reap_contact.data.id,
                                description: desc,
                                negotiatorId: negotiator_id
                            });
        
                            if(journal == 204){
                                console.log("Journal created for reapit");
                            }else{
                                console.log("Journal not created.");
                            }
                        }
                        continue;
                    }
    
                    for(var note of notes){
                        const desc = convert(note.properties.hs_note_body, { wordwrap: 130 });
                        var journalFound = journals.some(journal => convert(journal.description, {wordwrap:130}) === desc)
    
                        if(journalFound){
                            console.log("Journal already exists with same note body");
                        }else{
                            var negotiator_id = ""
                            const dealOwner = ownersMap[note.properties.hubspot_owner_id]
                            if(!dealOwner){
                                negotiator_id = null
                                //console.log("No deal owner associated.");
                            }else{
                                var neg = negotiatorsMap[dealOwner];
                                if(neg){
                                    negotiator_id = neg
                                    //console.log(`negotiator id mapped: ${negotiator_id}`);
                                }else{
                                    negotiator_id = null;
                                }
                            }
                            //const desc = convert(note.properties.hs_note_body, { wordwrap: 130 });
                            const journal = await createJournal({
                                associatedType: "contact",
                                associatedId: reap_contact.data.id,
                                description: desc,
                                negotiatorId: negotiator_id
                            });
        
                            if(journal == 204){
                                console.log("Journal created for reapit");
                            }else{
                                console.log("Journal not created.");
                            }
                        }
                    }
                } else{
                    console.log("Flag is false and therefore not processed further.")
                }
                
                // if(reap_contact){
                    
                //     const journals = await fetchApplicantJournal(reap_contact.data.id);
                //     //console.log(journals);
                //     if(Array.isArray(notes) && notes.length > 0){
                //         if(Array.isArray(journals) && journals.length > 0){
                //             for(var note of notes){
                //                 var journalFound = false;
                //                 var reapit_journal = {}
                //                 for(var journal of journals){
                //                     const desc = convert(note.properties.hs_note_body, { wordwrap: 130 });
                //                     if(desc == journal.description){
                //                         //console.log("Journal already exists with same note body");
                //                         journalFound = true;
                //                         reapit_journal = journal
                //                         break;
                //                     }
                //                 }
    
                //                 if(journalFound){
                //                     console.log("Journal already exists with same note body");
                //                 }else{
    
                //                     var negotiator_id = ""
                //                     const dealOwner = ownersMap[note.properties.hubspot_owner_id]
                //                     if(!dealOwner){
                //                         negotiator_id = null
                //                         console.log("No deal owner associated.");
                //                     }else{
                                        
                //                         var neg = negotiatorsMap[dealOwner];
                //                         if(neg){
                //                             negotiator_id = neg
                //                             //console.log(`negotiator id mapped: ${negotiator_id}`);
                //                         }else{
                //                             negotiator_id = null;
                //                         }
                //                     }
                //                     const desc = convert(note.properties.hs_note_body, { wordwrap: 130 });
                //                     const journal = await createJournal({
                //                         associatedType: "contact",
                //                         associatedId: reap_contact.data.id,
                //                         description: desc,
                //                         negotiatorId: negotiator_id
                //                     });
                
                //                     if(journal == 204){
                //                         console.log("Journal created for reapit");
                //                     }else{
                //                         console.log("Journal not created.");
                //                     }
                //                 }
                //             }
                //         }else{
                //             //console.log("No journals found. But new note created.");
                //             for(var note of notes){
    
                //                 var negotiator_id = ""
                //                 const dealOwner = ownersMap[note.properties.hubspot_owner_id]
                //                 if(!dealOwner){
                //                     negotiator_id = null
                //                     //console.log("No deal owner associated.");
                //                 }else{
                //                     var neg = negotiatorsMap[dealOwner];
                //                     if(neg){
                //                         negotiator_id = neg
                //                         //console.log(`negotiator id mapped: ${negotiator_id}`);
                //                     }else{
                //                         negotiator_id = null;
                //                     }
                //                 }
                //                 const desc = convert(note.properties.hs_note_body, { wordwrap: 130 });
                //                 const journal = await createJournal({
                //                     associatedType: "contact",
                //                     associatedId: reap_contact.data.id,
                //                     description: desc,
                //                     negotiatorId: negotiator_id
                //                 });
            
                //                 if(journal == 204){
                //                     console.log("Journal created for reapit");
                //                 }else{
                //                     console.log("Journal not created.");
                //                 }
                //             }
                //             //just create a journal
                //         }
                //     }else{
                //         console.log("No notes found associated to the contact");
                //     }
                // }else{
                //     console.log("No match found in Reapit contacts.");
                // }
            }
        }
    
        console.log("For contacts notes2journals completed successfully");
        return 1;
    } catch (error) {
        console.log(error);
        return error
    }
}

// *----------------------------------------------------------------------------------------
// * Function to create Reapit Negotiators from Hubspot Deal Owners
// ***** Reduced the time complexity from O(n^2) to O(n) , this function takes around 45 seconds to execute completely.
async function createNegotiatorsFromDealOwners(){

    try {
        
        var deal_owners = await fetchOwnersFromHubspot();
        var negotiators = await negotiatorsData();
        var negotiatorsSet = new Set(negotiators.map(negotiator => negotiator.email));
        
        for (var deal_owner of deal_owners) {
          if (!negotiatorsSet.has(deal_owner.email)) {
            var newNegotiator = {
              name: (deal_owner?.firstName || deal_owner?.lastName) ? `${deal_owner?.firstName} ${deal_owner?.lastName}` : deal_owner.email.substring(0, deal_owner.email.indexOf("@")),
              workPhone: null,
              mobilePhone: null,
              email: deal_owner?.email,
              officeId: 'TLH'
            }

            const createNegotiator = await createNewNegotiator(newNegotiator);
            console.log(createNegotiator);
          } else {
            console.log("Negotiator already exists.");
          }
        }
    
        console.log("Creating Negotiators function finished executing.");
        return
    } catch (error) {
        console.log(error);
        return error
    }
    
}

// *----------------------------------------------------------------------------------------
// * Function to sync Reapit Journals to Hubspot Notes.
async function journalToNote() {
    try {
        console.log('----------------Applicant Journal 2 Notes function initialized.-----------------');

        // Fetch owners, negotiators, and deals
        const [owners, negotiators, deals] = await Promise.all([
            fetchOwnersFromHubspot(),
            negotiatorsData(),
            fetchDealsFromHubspot()
        ]);

        // Create a negotiators map
        const negotiatorsMap = negotiators.reduce((map, negotiator) => {
            map[negotiator.id] = negotiator.email;
            return map;
        }, {});

        // Create an owners map
        const ownersMap = owners.reduce((map, owner) => {
            map[owner.email] = owner.id;
            return map;
        }, {});

        // Set batch size and total number of deals
        const batchSize = 10; // Adjust the batch size as needed
        var tempData = deals.slice(3000,4300)
        const totalDeals = tempData.length;

        let count = 0;

        // Process deals in batches
        for (let startIndex = 0; startIndex < totalDeals; startIndex += batchSize) {
            const endIndex = Math.min(startIndex + batchSize, totalDeals);
            const batchDeals = tempData.slice(startIndex, endIndex);
            const createBatch = [];

            // Process each deal in the batch
            for (const contact of batchDeals) {
                if (contact.properties.applicant_id) {
                    const journals = await fetchApplicantJournal(contact.properties.applicant_id);

                    if (Array.isArray(journals) && journals.length > 0) {
                        const notes = await fetchNotesForDeal(contact.id);

                        // Process each journal entry
                        for (const journal of journals) {
                            const desc = convert(journal.description, { wordwrap: 130 });
                            const noteExists = notes.some(
                                note => convert(note.properties.hs_note_body, { wordwrap: 130 }) === desc
                            );

                            if (noteExists || (journal.description.includes("|") && journal.description.includes("ID")) || (journal.description.includes("Deal Activity |"))) {
                                continue;
                            } else {
                                console.log('New note creation in process');
                                // Determine ownerId based on journal's negotiatorId
                                var ownerId = '';
                                if (journal.negotiatorId) {
                                    var negotiatorEmail = negotiatorsMap[journal.negotiatorId];
                                    if (negotiatorEmail) {
                                        ownerId = ownersMap[negotiatorEmail] || '';
                                    } else {
                                        ownerId = '';
                                    }
                                } else {
                                    ownerId = '';
                                }
                                // console.log(ownerId)

                                // Prepare note properties
                                const properties = {
                                    hs_timestamp: journal.created,
                                    hs_note_body: desc,
                                    hubspot_owner_id: ownerId,
                                };

                                // Prepare noteBody for creation
                                const noteBody = {
                                    properties,
                                    associations: [
                                        {
                                            to: { id: contact.id },
                                            types: [
                                                {
                                                    associationCategory: 'HUBSPOT_DEFINED',
                                                    associationTypeId: 12,
                                                },
                                            ],
                                        },
                                    ],
                                };

                                // Add noteBody to the batch
                                createBatch.push(noteBody);
                            }
                        }
                    }
                }
            }

            // Create notes in batch
            if (createBatch.length > 0) {
                await createBatchNote(createBatch);
            }

            // Update progress count
            count += batchDeals.length;
            console.log(`Processed ${count} out of ${totalDeals} deals.`);
        }

        console.log('Applicant journal 2 note finished executing.');
        return 1;
    } catch (error) {
        console.log(error);
        return error;
    }
}

// *-----------------------------------------------------------------------------------------
// * JSON Object of Deal Stages in Hubspot.

const dealStagesOptions = {
    "134449902": "Fresh Leads (Offplan Sales Pipeline)",
    "134449903": "No Answer / Non-responsive (Offplan Sales Pipeline)",
    "134449906": "Contact Made (Offplan Sales Pipeline)",
    "134449907": "Qualified Interest (Offplan Sales Pipeline)",
    "134449908": "Scheduling Meeting / Viewing (Offplan Sales Pipeline)",
    "134449909": "Meeting / Viewing Done (Offplan Sales Pipeline)",
    "134449910": "Next Action (Offplan Sales Pipeline)",
    "134502345": "Booking, payments & paperwork  (Offplan Sales Pipeline)",
    "134502346": "Down Payment (Offplan Sales Pipeline)",
    "141890244": "Sale completed (Offplan Sales Pipeline)",
    "134502347": "Lost / Invalid Lead (Offplan Sales Pipeline)",
    "134502348": "Future Prospect / Not Yet Ready (Offplan Sales Pipeline)"
};

// *-----------------------------------------------------------------------------------------
// * Function to sync Hubspot Deals Activity to Reapit Journals.
// ? Comments: this function takes : 15+ minutes Some deals have 100+ notes so taking time on that.
async function dealActivityToJournal(){

    try {
        console.log("-----------------Moving Deals Activity to Journal----------------------------");
    //deals from HS
    //negotiators from RT
    //owners from HS
        const [deals, negotiators, owners] = await Promise.all([
            fetchDealsFromHubspot(),
            negotiatorsData(),
            fetchOwnersFromHubspot()
        ]);
//{ "email": "negId"} map formed below
//each deal will have one owner in HS
//each applicant (corresponds to deal) will have a negotiator in RT
//Each deal will have some activities, fetch all activities, send all activities to RT corresponding to the applicant 
//in journal section.
        var negotiatorsMap = {}
        for(var negotiator of negotiators){
            negotiatorsMap[negotiator.email] = negotiator;
        }

        var ownersMap = {}
        for(var owner of owners){
            ownersMap[owner.id] = owner.email
        }

        var testData = deals.slice(14000);
        var count = 1
        for(var deal of testData){

            console.log(`<<---Deal processed: ${deal.id}-----count: ${count}---->>`)
            //console.log(deal.propertiesWithHistory);
            dealstageHistory = deal.propertiesWithHistory.dealstage;
    
            if(!deal.properties.applicant_id){
                console.log("Applicant not found.");
            }else{
                console.log(deal.properties.applicant_id)
                const journals = await fetchApplicantJournal(deal.properties.applicant_id)
                // ** Transfering deal activity to journals. -- TESTED
                for(var version of dealstageHistory){
                    var description = "";
                    var name = []
                    const stageValue = dealStagesOptions[version.value]
                    if(stageValue){
                        var negotiatorID = ""
                        if(deal.properties.hubspot_owner_id){
                            var user = await fetchDealOwnerById(deal.properties.hubspot_owner_id);
                            if(user.id){
                                name.push(user.firstName)
                                name.push(user.lastName)
                                name = name.filter((f) => {if(f) return f})
                                var matchInNegotiators = false;
                                var negId = {}
                                for(var negotiator of negotiators){
                                    if(negotiator.email == user.email){
                                        matchInNegotiators = true;
                                        negId = negotiator
                                        break;
                                    }
                                }
                                if(matchInNegotiators){
                                    negotiatorID = negId.id
                                }else{
                                    negotiatorID = null
                                }
                                
                            }else{
                                negotiatorID = null
                            }
                        }else{
                            negotiatorID = null
                        }
                        description = `Deal Activity | ${name.join(" ")} moved the deal to ${stageValue} | ${version.timestamp}`
    
                        var journalBody = {
                            associatedType: "applicant",
                            associatedId: deal.properties.applicant_id,
                            description: description,
                            negotiatorId: negotiatorID
                        }
                        //console.log(journalBody)
    
                        if(!deal.properties.applicant_id){
                            console.log("Applicant not present");
                        }else{
                            
                            var match = false
                            if(Array.isArray(journals) && journals.length > 0){
                                for(var journal of journals){
                                    if(journal.description == description){
                                        match = true;
                                        break;
                                    }
                                }
                            }
                            if(match){
                                console.log("Journal already exists with same description body.");
                            }else{
                                // console.log(journalBody)
                                const journalEntry = await createJournal(journalBody)
                                // console.log("Journal created", journalEntry);
                            }
                        }
        
                    }
                }
                console.log(`Deal activity loop finished. ${deal.id}`);
    
                const [tasks, calls, notes, emails, meetings] = await Promise.all([
                    fetchTasksforDeal(deal.id),
                    fetchCallsforDeal(deal.id),
                    fetchNotesForDeal(deal.id),
                    fetchEmailsforDeal(deal.id),
                    fetchMeetingsforDeal(deal.id)
                ]);
        
                // ** Transfering tasks to journals -- TESTED
                //const tasks = await fetchTasksforDeal(deal.id)
                // *----------------------------------------------------------------------------------
                if(Array.isArray(tasks) && tasks.length > 0){
                    for(var task of tasks){
                        var description = ""
        
                        var match = false
                        if(Array.isArray(journals) && journals.length > 0){
                            for(var journal of journals){
                                if(journal.description.includes(task.id)){
                                    match = true;
                                    break;
                                }
                            }
                        }
        
                        if(match){
                            console.log(`Task with id: ${task.id} already exists`);
                        }else{
                            var id = ` ID: ${task.id}`
    
                            var title = task.properties.hs_task_subject ? ` Title: ${task.properties.hs_task_subject} |` : "";
    
                            var taskBody = task.properties.hs_task_body ? ` Body: ${convert(task.properties.hs_task_body, { wordwrap: 130 })} |` : "";
    
                            var taskStatus = task.properties.hs_task_status ? ` Status: ${task.properties.hs_task_status} |` : ""
    
                            description = `Task |${title}${taskBody}${taskStatus}${id}`;
    
                            var negotiatorID = ""
                            if(task.properties.hubspot_owner_id){

                                var user = await fetchDealOwnerById(task.properties.hubspot_owner_id);
                                if(user.id){
                                    var matchInNegotiators = false;
                                    var negId = {}
                                    for(var negotiator of negotiators){
                                        if(negotiator.email == user.email){
                                            matchInNegotiators = true;
                                            negId = negotiator
                                            break;
                                        }
                                    }
                                    if(matchInNegotiators){
                                        negotiatorID = negId.id
                                    }else{
                                        negotiatorID = null
                                    }
                                }else{
                                    negotiatorID = null
                                }
                            } else{
                                negotiatorID = null
                            }
    
                            var journalBody = {
                                associatedType: "applicant",
                                associatedId: deal.properties.applicant_id,
                                description: description,
                                negotiatorId: negotiatorID
                            }
    
                            console.log(journalBody);
                            const journalEntry = await createJournal(journalBody)
                            console.log(`journal created for task: ${task.id}`, journalEntry);                        
                        }
                    }
    
                    console.log("Tasks loop finished.");
                }else{
                    console.log("No tasks found.");
                }
                console.log(`Tasks loop finished. ${deal.id}`);
    
                // ** Transfering calls to journals -- TESTED
                //const calls = await fetchCallsforDeal(deal.id)
                if(Array.isArray(calls) && calls.length > 0){
                    for(var call of calls){
                        var description = ""
        
                        var match = false
                        if(Array.isArray(journals) && journals.length > 0){
                            for(var journal of journals){
                                if(journal.description.includes(call.id)){
                                    match = true;
                                    break;
                                }
                            }
                        }
                        
                        if(match){
                            console.log(`Call with id: ${call.id} already exists`);
                        }else{
                            var id = ` ID: ${call.id}`
    
                            var title = call.properties.hs_call_title ? ` Title: ${call.properties.hs_call_title} |` : "";
    
                            var callBody = call.properties.hs_call_body ? ` Body: ${convert(call.properties.hs_call_body, { wordwrap: 130 })} |` : "";
    
                            var callStatus = call.properties.hs_call_status ? ` Status: ${call.properties.hs_call_status} |` : ""
    
                            var callDuration = call.properties.hs_call_duration ? ` Duration: ${call.properties.hs_call_duration} |` : ""
    
                            description = `Call |${title}${callBody}${callStatus}${callDuration}${id}`;
    
                            var negotiatorID = ""
                            if(call.properties.hubspot_owner_id){

                                var user = await fetchDealOwnerById(call.properties.hubspot_owner_id);
                                if(user.id){
                                    var matchInNegotiators = false;
                                    var negId = {}
                                    for(var negotiator of negotiators){
                                        if(negotiator.email == user.email){
                                            matchInNegotiators = true;
                                            negId = negotiator
                                            break;
                                        }
                                    }
                                    if(matchInNegotiators){
                                        negotiatorID = negId.id
                                    }else{
                                        negotiatorID = null
                                    }
                                }else{
                                    negotiatorID = null
                                }
                            } else{
                                negotiatorID = null
                            }
    
                            var journalBody = {
                                associatedType: "applicant",
                                associatedId: deal.properties.applicant_id,
                                description: description,
                                negotiatorId: negotiatorID
                            }
    
                            console.log(journalBody);
                            const journalEntry = await createJournal(journalBody)
                            console.log(`journal created for call: ${call.id}`, journalEntry);                        
                        }
                    }
                }else{
                    console.log("No calls found.");
                }
                console.log(`Calls loop finished. ${deal.id}`);
    
                // ** Transfering notes to journals -- TESTED
                //const notes = await fetchNotesForDeal(deal.id)
                if(Array.isArray(notes) && notes.length > 0){
                    var createBulkJournals = []
                    for(var note of notes){
                        
                        var description = ""
                        var match = journals.some(journal => (journal.description.includes(note.id) && journal.description.includes("Note |")) || journal.description === convert(note.properties.hs_note_body, { wordwrap: 130 }));
                                   
                        if(match){
                            // console.log(`Note with id: ${note.id} already exists`);
                        }else{
                            console.log(`Note with id: ${note.id} processing...`)
                            var id = ` ID: ${note.id}`
    
                            var noteBody = note.properties.hs_note_body ? ` Body: ${convert(note.properties.hs_note_body, { wordwrap: 130 })} |` : "";
    
                            description = `Note |${noteBody}${id}`;
    
                            var negotiatorID = ""
                            if(note.properties.hubspot_owner_id){
                                var dealOwnerEmail = ownersMap[note.properties.hubspot_owner_id]
                                var negData = negotiatorsMap[dealOwnerEmail]
                                if(negData){
                                    negotiatorID = negData.id;
                                }else{
                                    negotiatorID = null;
                                }
                            }else{
                                negotiatorID = null;
                            }
                            
                            var journalBody = {
                                associatedType: "applicant",
                                associatedId: deal.properties.applicant_id,
                                description: description,
                                negotiatorId: negotiatorID
                            }
                            
                            createBulkJournals.push(journalBody);
                            //console.log(journalBody);
                            // const journalEntry = await createJournal(journalBody)
                            // console.log(`journal created for note: ${note.id}`, journalEntry);                        
                        }
                    }
                    console.log(createBulkJournals.length);

                    await createBulkJournalEntries(createBulkJournals)
                }else{
                    console.log("No notes found.");
                }
                console.log(`Notes loop finished. ${deal.id}`);
    
                // ** Transfering emails to journals -- TESTED
                //const emails = await fetchEmailsforDeal(deal.id)
                if(Array.isArray(emails) && emails.length > 0){
                    for(var email of emails){
                        var description = ""
        
                        var match = false
                        if(Array.isArray(journals) && journals.length > 0){
                            for(var journal of journals){
                                if(journal.description.includes(email.id)){
                                    match = true;
                                    break;
                                }
                            }
                        }
                        
                        if(match){
                            console.log(`Email with id: ${email.id} already exists`);
                        }else{
                            var id = ` ID: ${email.id}`
    
                            var emailBody = email.properties.hs_email_text ? ` Body: ${convert(email.properties.hs_email_text, { wordwrap: 130 })} |` : "";
    
                            var status = email.properties.hs_email_status ? ` Status: ${email.properties.hs_email_status} |` : "";
    
                            var subject = email.properties.hs_email_subject ? ` Subject: ${email.properties.hs_email_subject} |` : ""
    
                            var recipient = email.properties.hs_email_to_email ? ` To: ${email.properties.hs_email_to_email} |` : ""
    
                            description = `Email |${recipient}${subject}${emailBody}${status}${id}`;
    
                            var negotiatorID = ""
                            if(email.properties.hubspot_owner_id){

                                var user = await fetchDealOwnerById(email.properties.hubspot_owner_id);
                                if(user.id){
                                    var matchInNegotiators = false;
                                    var negId = {}
                                    for(var negotiator of negotiators){
                                        if(negotiator.email == user.email){
                                            matchInNegotiators = true;
                                            negId = negotiator
                                            break;
                                        }
                                    }
                                    if(matchInNegotiators){
                                        negotiatorID = negId.id
                                    }else{
                                        negotiatorID = null
                                    }
                                }else{
                                    negotiatorID = null
                                }
                            } else{
                                negotiatorID = null
                            }
    
                            var journalBody = {
                                associatedType: "applicant",
                                associatedId: deal.properties.applicant_id,
                                description: description,
                                negotiatorId: negotiatorID
                            }
    
                            console.log(journalBody);
                            const journalEntry = await createJournal(journalBody)
                            console.log(`journal created for email: ${email.id}`, journalEntry);                        
                        }
                    }
                }else{
                    console.log("No emails found.");
                }
                console.log(`Emails loop finished. ${deal.id}`);
    
                // ** Transfering meetings to journals -- TESTED
                //const meetings = await fetchMeetingsforDeal(deal.id)
                if(Array.isArray(meetings) && meetings.length > 0){
                    for(var meeting of meetings){
                        var description = ""
        
                        var match = false
                        if(Array.isArray(journals) && journals.length > 0){
                            for(var journal of journals){
                                if(journal.description.includes(meeting.id)){
                                    match = true;
                                    break;
                                }
                            }
                        }
                        
                        if(match){
                            console.log(`Meeting with id: ${meeting.id} already exists`);
                        }else{
                            var id = ` ID: ${meeting.id}`
    
                            var meetingBody = meeting.properties.hs_meeting_body ? ` Body: ${convert(meeting.properties.hs_meeting_body, { wordwrap: 130 })} |` : "";
    
                            var outcome = meeting.properties.hs_meeting_outcome ? ` Outcome: ${meeting.properties.hs_meeting_outcome} |` : "";
    
                            var title = meeting.properties.hs_meeting_title ? ` Title: ${meeting.properties.hs_meeting_title} |` : ""
    
                            var start_time = meeting.properties.hs_meeting_start_time ? ` Start Time: ${meeting.properties.hs_meeting_start_time} |` : ""
    
                            var type = meeting.properties.hs_activity_type ? ` Type: ${meeting.properties.hs_activity_type} |` : "";
                            
                            var link = meeting.properties.hs_meeting_external_URL ? ` Link: ${meeting.properties.hs_meeting_external_URL} |` : "";
    
                            description = `Meeting |${title}${meetingBody}${type}${link}${start_time}${outcome}${id}`;
    
                            var negotiatorID = ""
                            if(meeting.properties.hubspot_owner_id){

                                var user = await fetchDealOwnerById(meeting.properties.hubspot_owner_id);
                                if(user.id){
                                    var matchInNegotiators = false;
                                    var negId = {}
                                    for(var negotiator of negotiators){
                                        if(negotiator.email == user.email){
                                            matchInNegotiators = true;
                                            negId = negotiator
                                            break;
                                        }
                                    }
                                    if(matchInNegotiators){
                                        negotiatorID = negId.id
                                    }else{
                                        negotiatorID = null
                                    }
                                }else{
                                    negotiatorID = null
                                }
                            } else{
                                negotiatorID = null
                            }
    
                            var journalBody = {
                                associatedType: "applicant",
                                associatedId: deal.properties.applicant_id,
                                description: description,
                                negotiatorId: negotiatorID
                            }
    
                            console.log(journalBody);
                            const journalEntry = await createJournal(journalBody)
                            console.log(`journal created for meeting: ${meeting.id}`, journalEntry);                        
                        }
                    }
                }else{
                    console.log("No meetings found.");
                }
                console.log(`Meetings loop finished. ${deal.id}`);
                // ------------------------------------------------------------
            }
            count++
            console.log("All deal activities transfered successfully to reapit.");
        }
    
        console.log("------------------All activities transfered to journals for all deals---------------");
        return 1;
    } catch (error) {
        console.log(error);
        return error
    }
}

// *-----------------------------------------------------------------------------------------
async function archiveReapitApplicantsJournalsSync(){

    try {
        console.log("------------Archived applicants Journals sync function started...---------------");
    
        const [
            // reapit, 
            hubspotContacts, 
            owners,
            negotiators
        ] = await Promise.all([
            // fetchArchivedReapitData(),
            fetchContactsFromHubspot(),
            fetchOwnersFromHubspot(),
            negotiatorsData()
        ]);
        //console.log(archiveData.length === 0, archiveData.length)
        
        var archiveData = await Archived_Reapit_Applicants.find();
        var tempData = archiveData.slice(10900,11000);
        if(archiveData.length === 0) {
            console.log("------*No archive data present*-------------")
            return 
        }

        const hubspotContactsMap = new Map();
        for (var hubCont of hubspotContacts) {
            const email = hubCont.properties.email;
            const mobilePhone = hubCont.properties.mobilephone;

            if (email) {
                hubspotContactsMap.set(email, hubCont);
            }

            if (mobilePhone) {
                hubspotContactsMap.set(mobilePhone, hubCont);
            }
        }
        
        var negotiatorsMap = {};
        for (var negotiator of negotiators) {
            negotiatorsMap[negotiator.id] = negotiator;
        }

        var ownersMap = {};
        for(var owner of owners){
            ownersMap[owner.email] = owner.id;
        }

        for(var archApplicant of tempData){
            
            var journals = await fetchApplicantJournal(archApplicant.data.id)
            console.log(`Journals count for archived applicant id: ${archApplicant.data.id}: ${journals?.length}`)
            
            for(var reapitContact of archApplicant.data.related){
                
                var matchedHubspotContact = false
                var hsContact = {}

                if(hubspotContactsMap.has(reapitContact.email) || hubspotContactsMap.has(reapitContact.mobilePhone)){
                    matchedHubspotContact = true
                    hsContact = hubspotContactsMap.get(reapitContact.email) || hubspotContactsMap.get(reapitContact.mobilePhone)
                }

                // var matchedHubspotContact = hubspotContactsMap[reapitContact.email];

                var newNotesBatch = []
                if(matchedHubspotContact){

                    console.log("contact matched.", hsContact.id)
                    const contactNotes = await fetchNotesForContact(hsContact.id)
                    if(Array.isArray(contactNotes) && contactNotes.length > 0){
                        for(var journal of journals){
                            // console.log("entered here")
                            const desc = convert(journal.description, { wordwrap: 130 })
                            // console.log(desc)
                            const noteExists = contactNotes.some(
                                note =>
                                    convert(note.properties.hs_note_body, { wordwrap: 130 }) === desc
                            );
                            // console.log(noteExists)
                            if(noteExists){
                                console.log(`Note already exists with same journal description || archived applicants journals sync || Applicant id: ${journal.associatedId}`)
                            }else{
                                var ownerID = "";
                                if(journal.negotiatorId){
                                    var negotiator = await fetchNegotiatorById(journal.negotiatorId) // negotiatorsMap[journal.negotiatorId]
                                    if(!negotiator){
                                        ownerID = "707859911";
                                        console.log("Raizul assigned as owner by default.");
                                    }else{
                                        var hubspotOwner = ownersMap[negotiator.email];
                                        if(hubspotOwner){
                                            ownerID = hubspotOwner
                                            console.log("Archived applicant Journal sync || Owner Id mapped:", ownerID)
                                        }else{
                                            ownerID = "707859911";
                                            console.log("Raizul assigned as owner by default.");
                                        }
                                    }
                                }

                                var properties = {
                                    hs_timestamp: journal.created,
                                    hs_note_body: desc,
                                    hubspot_owner_id: ownerID
                                };

                                var noteBody = {
                                    properties,
                                    associations: [
                                        {
                                            to: { id: hsContact.id },
                                            types: [
                                                {
                                                    associationCategory: 'HUBSPOT_DEFINED',
                                                    associationTypeId: 10,
                                                },
                                            ]
                                        }
                                    ]
                                }
                                console.log(noteBody.associations)

                                newNotesBatch.push(noteBody);
                            }
                        }
                    }else{
                        //console.log("all creation........")
                        for(var journal of journals){
                            var ownerID = "";
                            if(journal.negotiatorId){
                                var negotiator = await fetchNegotiatorById(journal.negotiatorId) // negotiatorsMap[journal.negotiatorId]
                                if(!negotiator){
                                    ownerID = "707859911";
                                    console.log("Raizul assigned as owner by default.");
                                }else{
                                    var hubspotOwner = ownersMap[negotiator.email];
                                    if(hubspotOwner){
                                        ownerID = hubspotOwner
                                        console.log("Archived applicant Journal sync || Owner Id mapped:", ownerID)
                                    }else{
                                        ownerID = "707859911";
                                        console.log("Raizul assigned as owner by default.");
                                    }
                                }
                            }

                            
                            var properties = {
                                hs_timestamp: journal.created,
                                hs_note_body: journal.description,
                                hubspot_owner_id: ownerID
                            };

                            var noteBody = {
                                properties,
                                associations: [
                                    {
                                        to: { id: hsContact.id },
                                        types: [
                                            {
                                                associationCategory: 'HUBSPOT_DEFINED',
                                                associationTypeId: 10,
                                            },
                                        ]
                                    }
                                ]
                            }
                            console.log(noteBody.associations)

                            newNotesBatch.push(noteBody);

                        }
                    }
                    
                    
                }else{
                    console.log("No contact matched in hubspot")
                }

                // console.log(newNotesBatch)
                console.log("New notes count: ",newNotesBatch.length)

                if(newNotesBatch.length > 0){
                    // for(var note of newNotesBatch){
                    //     await createNote(note)
                    // }
                    await createBatchNote(newNotesBatch);
                }
                
            }
        }

        console.log("--------*All archived applicants journals processed*--------------")
    } catch (error) {
        return error
    }
}

// *-----------------------------------------------------------------------------------------

module.exports = {
    ReapitDataTransfer,
    HubspotDataTransfer,
    createNegotiatorsFromDealOwners,
    ExistingHubspotDataTransfer,
    archiveReapitApplicants,
    journalToNote,
    // noteToJournal,
    contactJournal2Note,
    reapitContactToHubpotViaWebhooks,
    existingReapitContactsToHubspot,
    hubspotContactsToReapit,
    dealActivityToJournal,
    contactNotes2Journals,
    archiveReapitApplicantsJournalsSync,
    updateRoleInHubspot,
    updateArchive
}

async function migrateData(applicant) {
    const batchSize = 50; // Adjust the batch size as needed
    const contactsMap = {}; // Use plain object instead of Map for faster lookups
    const ownersMap = {}; // Use plain object for faster lookups
    
    // Populate contactsMap and ownersMap
    
    const relatedContacts = applicant.data.related;
    const totalContacts = relatedContacts.length;

    for (let i = 0; i < totalContacts; i += batchSize) {
        const batchContacts = relatedContacts.slice(i, i + batchSize);
        const batchPromises = batchContacts.map(async (contact) => {
            const journals = await fetchApplicantJournal(contact.id);
            
            if (Array.isArray(journals) && journals.length > 0) {
                const hubspotContact = contactsMap[contact.email] || contactsMap[contact.mobilePhone];
                if (hubspotContact) {
                    const notes = await fetchNotesForContact(hubspotContact.id);

                    const createBatch = journals.filter((journal) => {
                        const desc = convert(journal.description, { wordwrap: 130 });
                        return !notes.some(note =>
                            convert(note.properties.hs_note_body, { wordwrap: 130 }) === desc
                        );
                    }).map((journal) => {
                        // Your note creation logic
                    });

                    if (createBatch.length > 0) {
                        await Promise.all(createBatch.map(createNote));
                    }
                }
            }
        });

        await Promise.all(batchPromises);
    }
}
