const Https = require('https');
const Log = require("./log")

function get(url) {
    return new Promise(function (resole, reject) {

        Https.get(url, (res) => {
            const { statusCode } = res;
            const contentType = res.headers['content-type'];

            let error;
            if (statusCode !== 200) {
                error = new Error('Request Failed.\n' +
                    `Status Code: ${statusCode}`);
                
            } else if (!/^application\/json/.test(contentType)) {
                error = new Error('Invalid content-type.\n' +
                    `Expected application/json but received ${contentType}`);
            }
            if (error) {
                // console.error(error.message);
                // consume response data to free up memory
                // res.resume();
                Log.error(error.message);
                return resole(false);
            }

            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                return resole(rawData);
                // try {
                //     const parsedData = JSON.parse(rawData);
                //     console.log(parsedData);
                // } catch (e) {
                //     console.error(e.message);
                // }
            });
        }).on('error', (e) => {
            Log.error(e.message);
            return resole(false);
        });
    });
}



module.exports = {
    get: get
};