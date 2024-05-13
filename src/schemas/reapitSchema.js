// * OBJECT: 1 obj of HUBSPOT DEALS DATA

function reapitObj(OBJECT){
  
  const REAPIT_SCHEMA = {
    marketingMode:
      OBJECT.properties.marketingmode === undefined
        ? "buying"
        : OBJECT.properties.marketingmode, //OBJECT.marketingmode,
    currency:
      OBJECT.properties.deal_currency_code === undefined
        ? null
        : OBJECT.properties.deal_currency_code,
    active: OBJECT.properties.active ? OBJECT.properties.active : false,
    notes:
      OBJECT.properties.message_inquiry_comments === undefined
        ? null
        : OBJECT.properties.message_inquiry_comments,
    sellingStatus: OBJECT.properties.selling_status, //OBJECT.properties.dealstage === undefined ? "exchanged" : OBJECT.properties.dealstage,
    //"sellingPosition": OBJECT.properties.dealtype === undefined ? //"renting" : OBJECT.properties.dealtype,
    statusId: null,
    lastCall:
      OBJECT.properties.notes_last_updated === undefined
        ? null
        : OBJECT.properties.notes_last_updated,
    nextCall:
      OBJECT.properties?.future_prospecting_date &&
      new Date(OBJECT.properties?.future_prospecting_date) > new Date()
        ? OBJECT.properties.future_prospecting_date
        : null,
    departmentId: "G",
    solicitorId: null,
    potentialClient: null, // boolean
    type: [], // array
    style: [],
    situation: [],
    parking: [],
    age: ["new"], //OBJECT.properties.pipeline | [],
    locality: [],
    specialFeatures: [], //OBJECT.properties.amenities?.split(';'),
    unmappedRequirements: [],
    bedroomsMin: OBJECT.properties?.min_bedrooms ?? null,
    bathroomsMin: OBJECT.properties.min_bathrooms ?? null,
    bathroomsMax:
      OBJECT.properties?.max_bathrooms &&
      OBJECT.properties?.max_bathrooms >=
        (OBJECT.properties?.min_bathrooms ?? 0)
        ? OBJECT.properties?.max_bathrooms
        : OBJECT.properties?.min_bathrooms ?? null,
    bedroomsMax:
      OBJECT.properties?.max_bedrooms &&
      OBJECT.properties?.max_bedrooms >= (OBJECT.properties?.min_bedrooms ?? 0)
        ? OBJECT.properties?.max_bedrooms
        : OBJECT.properties?.min_bedrooms ?? null,
    receptionsMin: 0,
    receptionsMax: 0,
    parkingSpacesMin: 0,
    parkingSpacesMax: 0,
    locationType: "areas",
    locationOptions: [],
    archivedOn: "",
    fromArchive: "",
    buying:
      OBJECT.properties.price_from &&
      OBJECT.properties.price_to &&
      parseInt(OBJECT.properties.price_to) >
        parseInt(OBJECT.properties.price_from)
        ? {
            priceFrom:
              parseInt(OBJECT.properties.price_from) > 2000000000
                ? 2000000000
                : parseInt(OBJECT.properties.price_from),
            priceTo:
              parseInt(OBJECT.properties.price_to) > 2100000000
                ? 2100000000
                : parseInt(OBJECT.properties.price_to),
          }
        : null,
    renting: null,
    externalArea: null,
    internalArea: null,
    source: null,
    commercial: null,
    regional: null,
    officeIds: ["OPN"],
    negotiatorIds: [], //owner id
    related: [],
    metadata: {
      activityType:
        OBJECT.properties.activity_type === undefined
          ? null
          : OBJECT.properties.activity_type,
      alternateEmail:
        OBJECT.properties.alternate_email === undefined
          ? null
          : OBJECT.properties.alternate_email,
      amount:
        OBJECT.properties.amount === undefined
          ? null
          : OBJECT.properties.amount,
      assignedDate:
        OBJECT.properties.assigned_date === undefined
          ? null
          : OBJECT.properties.assigned_date,
      bookingDate:
        OBJECT.properties.booking_date === undefined
          ? null
          : OBJECT.properties.booking_date,
      buyingConsultantCommissionAmount:
        OBJECT.properties.buying_consultant_commission_amount,
      buyingConsultantCommissionPercentage:
        OBJECT.properties.buying_consultant_commission_percentage,
      clientBudget: OBJECT.properties.client_s_budget,
      city: OBJECT.properties.city,
      clientType: OBJECT.properties.client_type,
      email: OBJECT.properties.email,
      firstName: OBJECT.properties.first_name,
      lastName: OBJECT.properties.last_name,
      //"closeDate": OBJECT.properties.closedate,
      community:
        OBJECT.properties.community === undefined
          ? null
          : OBJECT.properties.community,
      country: OBJECT.properties.country,
      companyCommmissionAmount: OBJECT.properties.company_commission_amount,
      downPaymentDeposit: OBJECT.properties.down_payment_deposit_amount,
      //createDate: OBJECT.properties.createdate,
      //dateOfBirth: OBJECT.properties.date_of_birth,
      dealName: OBJECT.properties.dealname,
      dealCategory: OBJECT.properties.deal_category,
      dealstage: OBJECT.properties.dealstage,
      dealSource: OBJECT.properties.deal_source,
      description: OBJECT.properties.description,
      developer: OBJECT.properties.developer,
      hsAnalyticsLatestSource: OBJECT.properties.hs_analytics_latest_source,
      hsAnalyticsSource: OBJECT.properties.hs_analytics_source,
      hsObjectId: OBJECT.properties.hs_object_id,
      nationality: OBJECT.properties.nationality,
      pipeline: OBJECT.properties.pipeline,
      projectName: OBJECT.properties.project_name,
      propertyType: OBJECT.properties.property_type,
      subCommunity: OBJECT.properties.sub_community,
      typeOfDeal: OBJECT.properties.type_of_deal,
      unitType: OBJECT.properties.unit_type,
      views: OBJECT.properties.views,
      projectName: OBJECT.properties.project_name,
      reasonForLooking: OBJECT.properties.reason_for_looking,
      futureProspectingTimeframe:
        OBJECT.properties.future_prospecting_timeframe,
    },
  };
  
  // if(!(REAPIT_SCHEMA.bathroomsMax >= 2)){
  //   REAPIT_SCHEMA.bathroomsMax = 5;
  // }
  // if(!(REAPIT_SCHEMA.bedroomsMax >= 2)){
  //   REAPIT_SCHEMA.bedroomsMax = 5;
  // }
  REAPIT_SCHEMA.metadata = Object.fromEntries(
    Object.entries(REAPIT_SCHEMA.metadata).filter(([key, value]) => value !== null)
  );
  
  return REAPIT_SCHEMA;

};

// console.log(reapitObj({
//   "id": "8087919609",
//   "properties": {
//     "createdate": "2023-07-03T04:44:45.724Z",
//     "hs_lastmodifieddate": "2023-07-03T04:47:10.483Z",
//     "hs_object_id": "8087919609",
//     "price_from": "50000",
//     "price_to": "200000"
//   },
//   "createdAt": "2023-07-03T04:44:45.724Z",
//   "updatedAt": "2023-07-03T04:47:10.483Z",
//   "archived": false
// }))

function reapitContactObj(OBJECT){
  const reapitSchema = {
    type: "contact",
    forename:
      OBJECT.properties?.firstname?.length <= 20
        ? OBJECT.properties?.firstname
        : OBJECT.properties?.firstname?.substring(0, 20),
    surname:
      OBJECT.properties?.lastname?.length <= 20
        ? OBJECT.properties?.lastname
        : OBJECT.properties?.lastname?.substring(0, 20),
    dateOfBirth: OBJECT.properties.date_of_birth,
    active: OBJECT.properties.active,
    marketingConsent: OBJECT.properties.marketing_consent
      ? OBJECT.properties.marketing_consent
      : "grant",
    identityCheck: OBJECT.properties.identity_check,
    workPhone: OBJECT.properties.phone,
    mobilePhone: OBJECT.properties.mobilephone,
    homePhone: OBJECT.properties.home_phone_number,
    email: OBJECT.properties.email,
    communicationPreferenceEmail:
      OBJECT.properties.communication_preference_email,
    communicationPreferenceLetter:
      OBJECT.properties.communication_preference_letter,
    communicationPreferencePhone:
      OBJECT.properties.communication_preference_phone,
    communicationPreferenceSMS: OBJECT.properties.communication_preference_sms,
    negotiatorIds: [],
    officeIds: ["OPN"],
    categoryIds: [],
    metadata: {
      hubspotContactId: OBJECT.properties.hs_object_id,
    },
  };

  return reapitSchema;
}
module.exports = { reapitObj, reapitContactObj }


/*
"buying": {
  "priceFrom": 100000,
  "priceTo": 100000
},
"renting": {
  "rentFrom" : 100000,
  "rentTo": 100000
}
*/