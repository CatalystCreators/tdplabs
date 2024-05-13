for(var data of body.newReapitData){
    try {

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
        const response = await axios(config);
        console.log(response.headers)
        console.log(response.data)
        console.log("uploaded to reapit", response.headers.location, data.metadata.hsObjectId);

        // update applicant id to hubspot deal
        if(response.headers.location){
            var id = response.headers.location.split("/")
            console.log(id[id.length - 1]);

            const updateDealInHubspot = await hubspotClient.crm.deals.basicApi.update(data.metadata.hsObjectId,{
                properties: {
                    applicant_id: id[id.length - 1]
                }
            },undefined);
        }

    } catch (error) {
        console.log(error.data);
        console.log(data);
        console.log('error in sending data to reapit');
    }        
}