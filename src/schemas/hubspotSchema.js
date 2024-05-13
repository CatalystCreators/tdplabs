

function hubspotDealsObj(OBJECT){
    const HUBSPOT_DEALS_SCHEMA = {
        // id: OBJECT.id,
        properties: {
            active: OBJECT.active?.toString(),
            applicant_id: OBJECT.id,
            activity_type: "",
            alternate_email: "",
            // amenities: OBJECT.specialFeatures?.join(';'),
            amount: OBJECT.metadata?.amount,
            booking_date: OBJECT.metadata?.bookingDate,
            buying_consultant_commission_amount: OBJECT.metadata?.buyingConsultantCommissionAmount === null ? 0 : OBJECT.metadata?.buyingConsultantCommissionAmount,
            buying_consultant_commission_percentage: OBJECT.metadata?.buyingConsultantCommissionPercentage,
            client_type: OBJECT.clientType,
            company_commission_amount: OBJECT.metadata?.companyCommmissionAmount,
            down_payment_deposit_amount: OBJECT.metadata?.downPaymentDeposit,
            //assigned_date: '',
            max_bathrooms: OBJECT.bathroomsMax,
            max_bedrooms: OBJECT.bedroomsMax,
            min_bathrooms: OBJECT.bathroomsMin,
            min_bedrooms: OBJECT.bedroomsMin,
            deal_currency_code: OBJECT.currency,
            property_type: OBJECT.metadata?.propertyType,
            type_of_deal: OBJECT.metadata?.typeOfDeal,
            city: OBJECT.metadata?.city,
            community: OBJECT.metadata?.community,
            sub_community: OBJECT.metadata?.subCommunity,
            country: OBJECT.metadata?.country === null ? "United Arab Emirates" : OBJECT.metadata?.country,
            dealname: OBJECT.related[0].name,
            dealstage: OBJECT.sellingStatus === "exchanged" ? "134449902" : "134449902",//OBJECT._links.status.href,//OBJECT.type,
            closedate: OBJECT.metadata?.closedate,
            message_inquiry_comments: OBJECT.notes,
            email: OBJECT.related[0].email,
            first_name: OBJECT.related[0].forename,
            last_name: OBJECT.related[0].surname,
            price_from: OBJECT.buying?.priceFrom,
            price_to: OBJECT.buying?.priceTo,
            //mobile_number: OBJECT.related[0].mobilePhone,
            pipeline: "default",//OBJECT.age
            future_prospecting_timeframe: OBJECT.metadata?.futureProspectingTimeframe,
            project_name: OBJECT.metadata?.projectName,
            reason_for_looking: OBJECT.metadata?.reasonForLooking,
            phone_number: OBJECT.related[0].workPhone,
            mobile_number: OBJECT.related[0].mobilePhone,
            home_phone_number: OBJECT.related[0].homePhone,
            archived_status: OBJECT.fromArchive,
            //createdate: OBJECT.created
        }
        // createdAt: OBJECT.created,
        // updatedAt: OBJECT.modified,
        // archived: OBJECT.fromArchive
    }

    return HUBSPOT_DEALS_SCHEMA;
};

function hubspotContactsObj(OBJECT){
    const HUBSPOT_CONTACTS_SCHEMA = {
        properties: {
            active: OBJECT.active,
            email: OBJECT.email,
            firstname: OBJECT.forename,
            lastname: OBJECT.surname,
            mobilephone: OBJECT.mobilePhone,
            phone: OBJECT.workPhone,
            home_phone_number: OBJECT.homePhone,
            reapit_contact_id: OBJECT.id,
            date_of_birth: OBJECT.dateOfBirth,
            marketing_consent: OBJECT.marketingConsent,
            identity_check: OBJECT.identityCheck,
            deal_source: null,
            communication_preference_letter: OBJECT.communicationPreferenceLetter,
            communication_preference_email: OBJECT.communicationPreferenceEmail,
            communication_preference_phone: OBJECT.communicationPreferencePhone,
            communication_preference_sms: OBJECT.communicationPreferenceSMS,
            hubspot_owner_id: null,
            client_type: null,
            archived: OBJECT.fromArchive == false ? "False": "True"
        }
    }

    return HUBSPOT_CONTACTS_SCHEMA;
}

module.exports = { 
    hubspotDealsObj,
    hubspotContactsObj 
}

