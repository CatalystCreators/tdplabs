const Bottleneck = require('bottleneck');
const limiter = new Bottleneck({
    maxConcurrent: 9,
    minTime: 100
});

async function fetchContactsFromHubspot(){
    let result = [];
    
    const limit = 100;
    let after = 0;
    const properties = [
        'hubspot_owner_id','email','deal_owner',
        'date_of_birth','firstname','lastname',
        'phone','mobilephone','activity_type', 'alternate_email',
        'amenities','amount','deal_name','pipeline', 'contact_source',
        'marketing_mode', 'currency', 'active', 'message_inquiry_comments', 
        'department_id', 'potential_client', 'min_bedrooms', 'max_bedrooms','home_phone_number',
        'min_bathrooms', 'max_bathrooms', 'reapit_contact_id', 'price_from', 'price_to'
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

            let contacts = apiResponse.results.filter((f) =>{
                if(f.properties.lastname) return f;
            });

            result = result.concat(contacts);
            if(apiResponse.paging && apiResponse.paging.next){
                after = apiResponse.paging.next.after;
            }else{
                after = null;
            }
            // console.log(apiResponse.paging.next.after)
        }
        console.log("Total contacts from Hubspot: ", result.length);
        return result
    } catch (error) {
        console.log(error);
        return error;
    }
}